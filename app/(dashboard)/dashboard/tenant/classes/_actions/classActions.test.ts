import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the schedule creation Server Action (KEL-50).
 *
 * The action is the boundary where the dashboard's own validation meets the
 * academic service, so what is asserted is the observable contract the
 * acceptance criteria depend on:
 *
 * - the forwarded request body carries a numeric per-slot `capacity`,
 * - a payload whose capacity is empty, zero, negative, or fractional never
 *   reaches the network (the schema refuses it first),
 * - `403 Permission denied` (a member without `schedule:create`) surfaces as a
 *   permission message instead of the raw backend text, and
 * - a class deleted while the form was open (`404`) is reported as such.
 *
 * `next/headers`, `next/cache`, and `@/lib/gateway` are mocked through
 * `vi.mock` rather than by stubbing globals because the action imports them by
 * module path; `fetch` is stubbed per test.
 */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'auth_token') return { name, value: 'session-token' };
      if (name === 'tenant_id') return { name, value: 'tenant-1' };
      return undefined;
    },
  })),
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }));

const { createClass, createSchedule } = await import('./classActions');

const GATEWAY_URL = 'http://gateway.test';

const CLASS_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';

function formDataOf(schedules: unknown): FormData {
  const formData = new FormData();
  formData.set('class_id', CLASS_ID);
  formData.set('schedules', JSON.stringify(schedules));
  return formData;
}

const validSchedules = [
  { day_of_week: 3, start_time: '14:00', end_time: '15:30', capacity: 10 },
];

function success(data: unknown = {}) {
  return new Response(
    JSON.stringify({
      status: 'success',
      message: 'Schedules and sessions created successfully',
      data,
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
}

function failure(status: number, message = 'refused') {
  return new Response(JSON.stringify({ status: 'error', message, data: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

const EMPTY_STATE = { success: false, message: '' };

beforeEach(() => {
  savedGatewayUrl = process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = GATEWAY_URL;
  revalidatePath.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();

  if (savedGatewayUrl === undefined) {
    delete process.env.GATEWAY_API_URL;
  } else {
    process.env.GATEWAY_API_URL = savedGatewayUrl;
  }
});

describe('createSchedule', () => {
  it('sends a numeric capacity per slot in the request body', async () => {
    installFetch(success({ schedules: [] }));

    const state = await createSchedule(
      EMPTY_STATE,
      formDataOf([
        { day_of_week: 1, start_time: '09:00', end_time: '10:30', capacity: 10 },
        { day_of_week: 3, start_time: '14:00', end_time: '15:30', capacity: 4 },
      ])
    );

    expect(state.success).toBe(true);

    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.class_id).toBe(CLASS_ID);
    expect(body.schedules).toEqual([
      // The action pads HH:MM times to HH:MM:SS before sending.
      { day_of_week: 1, start_time: '09:00:00', end_time: '10:30:00', capacity: 10 },
      { day_of_week: 3, start_time: '14:00:00', end_time: '15:30:00', capacity: 4 },
    ]);
    for (const slot of body.schedules) {
      expect(Number.isInteger(slot.capacity)).toBe(true);
      expect(slot.capacity).toBeGreaterThanOrEqual(1);
    }
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/classes');
  });

  it.each([
    ['an empty capacity', ''],
    ['zero', 0],
    ['a negative capacity', -2],
    ['a fractional capacity', 2.5],
  ])('never reaches the network for %s', async (_label, capacity) => {
    installFetch(success({}));

    const state = await createSchedule(
      EMPTY_STATE,
      formDataOf([{ ...validSchedules[0], capacity }])
    );

    expect(state.success).toBe(false);
    expect(state.message).toContain('Validation failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a 403 denial onto the schedule:create permission message', async () => {
    installFetch(failure(403, 'Permission denied'));

    const state = await createSchedule(EMPTY_STATE, formDataOf(validSchedules));

    expect(state.success).toBe(false);
    expect(state.message).toBe(
      'You do not have permission to create schedules. Ask a tenant administrator for the schedule:create permission.'
    );
    expect(state.message).not.toBe('Permission denied');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps a 404 onto a message about the class disappearing', async () => {
    installFetch(failure(404, 'class not found'));

    const state = await createSchedule(EMPTY_STATE, formDataOf(validSchedules));

    expect(state.success).toBe(false);
    expect(state.message).toBe(
      'This class or its enrollment no longer exists. Close this form and refresh the list.'
    );
  });

  it('maps an expired session onto a sign-in message instead of the raw text', async () => {
    installFetch(failure(401, 'token invalid'));

    const state = await createSchedule(EMPTY_STATE, formDataOf(validSchedules));

    expect(state.success).toBe(false);
    expect(state.message).toBe(
      'Your session has expired. Please sign in again to save the schedules.'
    );
  });
});

/**
 * KEL-113: capacity is set per schedule, so `createClass` must stop reading
 * the field from the form submission. Even a FormData that still carries the
 * legacy input (a stale browser tab) must produce a request body without the
 * key, because `validation.data` holds only the parsed schema fields.
 */
describe('createClass', () => {
  function classFormDataOf(entries: Array<[string, string]>): FormData {
    const formData = new FormData();
    for (const [name, value] of entries) {
      formData.set(name, value);
    }
    return formData;
  }

  const CLASS_STATE = { success: false, message: '' };

  function classSuccess() {
    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Class created',
        data: { id: 'class-1' },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  it('forwards the class payload without capacity even when FormData still carries it', async () => {
    installFetch(classSuccess());

    const state = await createClass(
      CLASS_STATE,
      classFormDataOf([
        ['category_id', 'cat-1'],
        ['name', 'Fisika Dasar'],
        ['type', 'group'],
        ['price', '150000'],
        // Legacy field from a stale tab: the form no longer renders it.
        ['capacity', '10'],
        ['description', 'Kelas pengantar fisika'],
      ])
    );

    expect(state.success).toBe(true);

    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string
    );
    expect(body).toEqual({
      category_id: 'cat-1',
      name: 'Fisika Dasar',
      type: 'group',
      price: 150000,
      description: 'Kelas pengantar fisika',
    });
    expect('capacity' in body).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/classes');
  });

  it('validates the payload and reports field errors before the network', async () => {
    installFetch(classSuccess());

    const state = await createClass(
      CLASS_STATE,
      classFormDataOf([
        ['category_id', ''],
        ['name', '   '],
        ['type', 'group'],
        ['price', '-5'],
      ])
    );

    expect(state.success).toBe(false);
    expect(state.message).toContain('Validation failed');
    expect(state.errors?.category_id?.[0]).toBe('Please select a valid category');
    expect(state.errors?.name?.[0]).toBe('Class name is required');
    expect(state.errors?.price?.[0]).toBe('Price cannot be negative');
    expect(state.errors?.capacity).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
