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

const { assignScheduleTeacher, createClass, createSchedule, getScheduleTeachers, updateCategory, deleteCategory } = await import('./classActions');

const TEACHER_ID = 'f231dcfe-a8d2-4b2a-b682-43fe0fbb7022';
const teacherMember = { id: TEACHER_ID, user_id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11', email: 'teacher@example.test', first_name: 'Teacher', last_name: 'One', status: 'active', role: { id: 'role', name: 'Teacher' } };

it('loads all member pages, filters active Teacher and uses membership rather than account id', async () => {
  fetchMock = vi.fn()
    .mockResolvedValueOnce(success({ items: [{ ...teacherMember, role: { id: 'role', name: 'Creator' } }], pagination: { page: 1, total_pages: 2 } }))
    .mockResolvedValueOnce(success({ items: [teacherMember, { ...teacherMember, status: 'inactive' }], pagination: { page: 2, total_pages: 2 } }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getScheduleTeachers()).toEqual({ state: 'ok', teachers: [{ id: TEACHER_ID, name: 'Teacher One' }] });
  expect(fetchMock.mock.calls[1][0]).toContain('page=2');
});

it('includes system Creator once across pages and excludes inactive and custom Creator roles', async () => {
  const creator = { ...teacherMember, id: CLASS_ID, first_name: 'Owner', role: { id: 'creator-role', name: 'Creator', is_system_role: true } };
  fetchMock = vi.fn()
    .mockResolvedValueOnce(success({ items: [creator, { ...creator, id: 'inactive-owner', status: 'inactive' }, { ...creator, id: 'custom-owner', role: { ...creator.role, is_system_role: false } }], pagination: { page: 1, total_pages: 2 } }))
    .mockResolvedValueOnce(success({ items: [creator, teacherMember], pagination: { page: 2, total_pages: 2 } }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getScheduleTeachers()).toEqual({ state: 'ok', teachers: [
    { id: CLASS_ID, name: 'Owner One' }, { id: TEACHER_ID, name: 'Teacher One' },
  ] });
  expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer session-token' });
  expect(fetchMock.mock.calls[1][0]).toContain('page=2');
});

it('discards loaded Creator choices if a later member page fails', async () => {
  fetchMock = vi.fn()
    .mockResolvedValueOnce(success({ items: [{ ...teacherMember, role: { id: 'creator', name: 'Creator', is_system_role: true } }], pagination: { page: 1, total_pages: 2 } }))
    .mockResolvedValueOnce(failure(500));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getScheduleTeachers()).toEqual({ state: 'error' });
});

it.each([403, 500])('reports member read failure %s', async (status) => {
  installFetch(failure(status));
  expect(await getScheduleTeachers()).toEqual({ state: status === 403 ? 'forbidden' : 'error' });
});

it('assigns exact membership id and RFC3339 date using the academic contract', async () => {
  installFetch(success());
  expect((await assignScheduleTeacher(CLASS_ID, TEACHER_ID, '2026-10-14')).success).toBe(true);
  expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/schedules/tutor-permanent');
  expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ schedule_id: CLASS_ID, new_tutor_id: teacherMember.id, effective_date: '2026-10-14T00:00:00Z' });
});

it.each([400, 403, 404, 503])('assignment failure %s stays an error', async (status) => {
  installFetch(failure(status));
  expect((await assignScheduleTeacher(CLASS_ID, TEACHER_ID, '2026-10-14')).success).toBe(false);
  expect(revalidatePath).not.toHaveBeenCalled();
});

it('sends exact tutor membership body, never user_id', async () => {
  installFetch(success());
  expect((await createSchedule({ success: false, message: '' }, formDataOf([{ ...validSchedules[0], tutor_id: TEACHER_ID }]))).success).toBe(true);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ class_id: CLASS_ID, schedules: [{ day_of_week: 3, start_time: '14:00:00', end_time: '15:30:00', capacity: 10, tutor_id: TEACHER_ID }] });
});

it('rejects malformed teacher id before the network', async () => {
  installFetch(success());
  expect((await createSchedule({ success: false, message: '' }, formDataOf([{ ...validSchedules[0], tutor_id: 'not-a-member-id' }]))).success).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

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

describe('category mutations', () => {
  it('renames using the exact pointer-field PATCH contract, omitting description and browser tenant', async () => {
    installFetch(success());
    const form = new FormData();
    form.set('name', ' New name ');
    form.set('tenant_id', 'untrusted');
    expect((await updateCategory(CLASS_ID, form)).success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(`${GATEWAY_URL}/api/v1/categories/${CLASS_ID}`, expect.objectContaining({ method: 'PATCH', body: '{"name":"New name"}', headers: expect.objectContaining({ Authorization: 'Bearer session-token', 'X-Tenant-ID': 'tenant-1' }) }));
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/classes');
  });
  it.each(['', ' ', 'x'.repeat(101)])('rejects invalid name before network: %s', async (name) => {
    installFetch(success());
    const form = new FormData(); form.set('name', name);
    expect((await updateCategory(CLASS_ID, form)).errors?.name).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('sends edited non-empty description using the create string representation', async () => {
    installFetch(success());
    const form = new FormData();
    form.set('name', 'Math');
    form.set('description', ' Updated description ');
    expect((await updateCategory(CLASS_ID, form)).success).toBe(true);
    expect(fetchMock.mock.calls[0][1].body).toBe('{"name":"Math","description":"Updated description"}');
  });
  it.each(['', '   '])('rejects clearing description before network: %s', async (description) => {
    installFetch(success());
    const form = new FormData();
    form.set('name', 'Math');
    form.set('description', description);
    const result = await updateCategory(CLASS_ID, form);
    expect(result.success).toBe(false);
    expect(result.errors?.description?.[0]).toContain('cannot be cleared');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it('deletes unused category without a body and revalidates', async () => {
    installFetch(success());
    expect((await deleteCategory(CLASS_ID)).success).toBe(true);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalled();
  });
  it.each([401, 403, 404, 409, 422, 503])('keeps failure actionable and does not revalidate: %s', async (status) => {
    installFetch(failure(status));
    const result = await deleteCategory(CLASS_ID);
    expect(result.success).toBe(false);
    expect(result.message).not.toBe('refused');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it('rejects invalid id before network', async () => {
    installFetch(success());
    expect((await deleteCategory('../other')).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

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
