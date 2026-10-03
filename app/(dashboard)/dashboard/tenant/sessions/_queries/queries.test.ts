import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListPagination } from '@/lib/list-envelope';

/**
 * Integration test for the tutor session overview reader (KEL-137).
 *
 * The module cannot reach its real collaborators here: `next/headers` needs
 * a request scope, and the gateway reads go out over `fetch`. Both are
 * replaced with stand-ins that keep the observable contract:
 *
 * - the cookie store answers the two cookie names the reader looks up,
 * - `fetch` is a stub routed by URL, so the test asserts exactly which
 *   academic requests a given page state produces.
 *
 * The behaviours pinned here are the ones the acceptance criteria name:
 * authorization failures surface as `forbidden` (not as a technical error),
 * the list is always scoped with `mine=true` and the Jakarta date window
 * rather than filtered in the browser, rescheduled rows are kept, and an
 * attendance lookup that fails degrades to "no attendance shown" instead of
 * taking the whole page down.
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

const { getTutorSessions } = await import('./queries');

const GATEWAY_URL = 'http://gateway.test';

const SESSION_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const RESCHEDULED_SESSION_ID = '8d2c7e10-9f3b-4a5c-b6d7-1e2f3a4b5c6d';
const ENROLLMENT_ID = 'c0ffee00-1111-4222-8333-444455556666';
const SECOND_ENROLLMENT_ID = 'd1ffee00-1111-4222-8333-444455556666';

function pagination(overrides: Partial<ListPagination> = {}): ListPagination {
  return { page: 1, page_size: 100, total_items: 1, total_pages: 1, ...overrides };
}

function success(data: unknown) {
  return new Response(JSON.stringify({ status: 'success', message: 'ok', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function failure(status: number, message = 'refused') {
  return new Response(JSON.stringify({ status: 'error', message, data: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    class_id: 'class-1',
    schedule_id: 'schedule-1',
    tutor_id: 'tutor-1',
    session_date: '2026-09-30',
    start_time: '15:30:00',
    end_time: '17:00:00',
    status: 'scheduled',
    class: { id: 'class-1', name: 'Matematika Dasar' },
    ...overrides,
  };
}

type Route = (url: string) => Response | undefined;

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(route: Route) {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const response = route(url);

    if (!response) {
      throw new Error(`Unexpected request in test: ${url}`);
    }

    return response;
  });

  vi.stubGlobal('fetch', fetchMock);
}

/** Requests the reader made, in order. */
function requestedPaths(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function headersOf(path: string): Record<string, string> {
  const call = fetchMock.mock.calls.find((entry) => String(entry[0]) === path);

  return (call?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
}

function sessionsRoute(sessions: unknown[], tutors: unknown[] = []) {
  return (url: string) => {
    if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
      return success({ items: sessions, pagination: pagination({ total_items: sessions.length }) });
    }
    if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions/`) && url.endsWith('/attendees')) {
      return success([]);
    }
    if (url.startsWith(`${GATEWAY_URL}/api/v1/attendance`)) {
      return success({ items: [], pagination: pagination({ total_items: 0 }) });
    }
    if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
      return success({ items: [], pagination: pagination({ total_items: 0 }) });
    }
    if (url.startsWith(`${GATEWAY_URL}/api/v1/tutors`)) {
      return success({ items: tutors, pagination: pagination({ total_items: tutors.length }) });
    }
    return undefined;
  };
}

beforeEach(() => {
  savedGatewayUrl = process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = GATEWAY_URL;
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

describe('getTutorSessions', () => {
  it('always scopes the list with mine=true and the Jakarta date window', async () => {
    installFetch(sessionsRoute([sessionRow()]));

    const result = await getTutorSessions({ range: 'week' });

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0].session.id).toBe(SESSION_ID);
    }

    const sessionCall = requestedPaths().find((path) =>
      path.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)
    ) as string;
    const query = new URLSearchParams(sessionCall.split('?')[1]);

    expect(query.get('mine')).toBe('true');
    expect(query.get('tutor_id')).toBeNull();
    expect(query.get('date_from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query.get('date_to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query.get('date_from')! <= query.get('date_to')!).toBe(true);
    expect(headersOf(sessionCall)).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
  });

  it('keeps rescheduled rows alongside scheduled ones', async () => {
    installFetch(
      sessionsRoute([sessionRow(), sessionRow({ id: RESCHEDULED_SESSION_ID, status: 'rescheduled' })])
    );

    const result = await getTutorSessions({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.rows.map((row) => row.session.status)).toEqual([
        'scheduled',
        'rescheduled',
      ]);
    }
  });

  it('forwards the accepted class filter to the backend', async () => {
    installFetch(sessionsRoute([]));

    const classId = 'aaaaaaaa-1111-4222-8333-444455556666';
    const result = await getTutorSessions({ class_id: classId });

    expect(result.error).toBeNull();

    const sessionCall = requestedPaths().find((path) =>
      path.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)
    ) as string;
    const query = new URLSearchParams(sessionCall.split('?')[1]);

    expect(query.get('class_id')).toBe(classId);
  });

  it('reports a refused session read as forbidden without a technical message', async () => {
    // 401 covers an expired session, 403 a member without `schedule:read`.
    for (const status of [401, 403]) {
      installFetch((url) => {
        if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions`)) {
          return failure(status, 'insufficient permission');
        }
        if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
          return success({ items: [], pagination: pagination() });
        }
        return undefined;
      });

      const result = await getTutorSessions({});

      expect(result.error).toBe('forbidden');
      if (result.error === 'forbidden') {
        expect(result.message).toContain('schedule:read');
        // The backend's own wording must not leak into the tenant's screen.
        expect(result.message).not.toContain('insufficient permission');
      }
    }
  });

  it('reports a successful HTTP answer that is not a success envelope as an api error', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions`)) {
        return failure(500, 'internal error');
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTutorSessions({});

    expect(result.error).toBe('api');
    if (result.error === 'api') {
      expect(result.message).not.toContain('internal error');
    }
    // A failed session read must not trigger attendee or attendance lookups.
    expect(requestedPaths().some((path) => path.includes('/attendees'))).toBe(false);
    expect(
      requestedPaths().some((path) => path.startsWith(`${GATEWAY_URL}/api/v1/attendance`))
    ).toBe(false);
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;
    installFetch(() => undefined);

    const result = await getTutorSessions({});

    expect(result.error).toBe('configuration');
    if (result.error === 'configuration') {
      expect(result.message).toContain('GATEWAY_API_URL');
    }
  });

  it('refuses an invalid filter without calling the backend', async () => {
    installFetch(() => undefined);

    const result = await getTutorSessions({ range: 'month' });

    expect(result).toEqual({ data: null, error: 'invalid_filter' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads attendees from the bare-array endpoint and matches saved attendance by session', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return success({ items: [sessionRow()], pagination: pagination() });
      }
      if (url.includes('/attendees')) {
        return success([
          { id: ENROLLMENT_ID, student: { first_name: 'Ayu', last_name: 'Lestari' } },
          { id: SECOND_ENROLLMENT_ID, student: { first_name: 'Budi', last_name: null } },
        ]);
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/attendance`)) {
        const query = new URLSearchParams(url.split('?')[1]);
        const enrollmentId = query.get('enrollment_id');

        if (enrollmentId === ENROLLMENT_ID) {
          return success({
            items: [
              {
                id: 'att-1',
                enrollment_id: ENROLLMENT_ID,
                session_id: SESSION_ID,
                status: 'present',
              },
              // A row of another session must not leak into this session.
              {
                id: 'att-other',
                enrollment_id: ENROLLMENT_ID,
                session_id: 'other-session',
                status: 'absent',
              },
            ],
            pagination: pagination({ total_items: 2 }),
          });
        }

        return success({ items: [], pagination: pagination({ total_items: 0 }) });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTutorSessions({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      const [row] = result.data.rows;

      expect(row.attendees).toHaveLength(2);
      expect(row.attendance.get(ENROLLMENT_ID)?.status).toBe('present');
      expect(row.attendance.has(SECOND_ENROLLMENT_ID)).toBe(false);
      expect(row.attendanceForbidden).toBeUndefined();
    }

    // One attendance lookup per attendee, addressed by enrollment.
    const attendanceCalls = requestedPaths().filter((path) =>
      path.startsWith(`${GATEWAY_URL}/api/v1/attendance`)
    );

    expect(attendanceCalls).toHaveLength(2);
    expect(attendanceCalls[0]).toContain(`enrollment_id=${ENROLLMENT_ID}`);
  });

  it('keeps the session when an attendee read fails', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return success({ items: [sessionRow()], pagination: pagination() });
      }
      if (url.includes('/attendees')) {
        return failure(500, 'attendee read failed');
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTutorSessions({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0].attendees).toEqual([]);
    }
    // No attendees means no attendance lookups.
    expect(
      requestedPaths().some((path) => path.startsWith(`${GATEWAY_URL}/api/v1/attendance`))
    ).toBe(false);
  });

  it('keeps the session when a single attendance lookup fails', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return success({ items: [sessionRow()], pagination: pagination() });
      }
      if (url.includes('/attendees')) {
        return success([
          { id: ENROLLMENT_ID, student: { first_name: 'Ayu' } },
          { id: SECOND_ENROLLMENT_ID, student: { first_name: 'Budi' } },
        ]);
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/attendance`)) {
        const query = new URLSearchParams(url.split('?')[1]);

        if (query.get('enrollment_id') === ENROLLMENT_ID) {
          return failure(500, 'attendance unavailable');
        }

        return success({
          items: [
            {
              id: 'att-2',
              enrollment_id: SECOND_ENROLLMENT_ID,
              session_id: SESSION_ID,
              status: 'late',
            },
          ],
          pagination: pagination(),
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTutorSessions({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      const [row] = result.data.rows;

      expect(row.attendees).toHaveLength(2);
      expect(row.attendance.has(ENROLLMENT_ID)).toBe(false);
      expect(row.attendance.get(SECOND_ENROLLMENT_ID)?.status).toBe('late');
    }
  });

  it('marks attendance refused with 403 as unavailable to the role, not as missing', async () => {
    // A member without `attendance:read` is refused by the academic service.
    // Other failures keep degrading to "no attendance to show".
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return success({ items: [sessionRow()], pagination: pagination() });
      }
      if (url.includes('/attendees')) {
        return success([
          { id: ENROLLMENT_ID, student: { first_name: 'Ayu' } },
          { id: SECOND_ENROLLMENT_ID, student: { first_name: 'Budi' } },
        ]);
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/attendance`)) {
        const query = new URLSearchParams(url.split('?')[1]);

        return query.get('enrollment_id') === ENROLLMENT_ID
          ? failure(403, 'insufficient permission')
          : failure(503, 'Authorization service unavailable');
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTutorSessions({});

    // The session list itself stays readable.
    expect(result.error).toBeNull();
    if (result.error === null) {
      const [row] = result.data.rows;

      expect(row.attendanceForbidden).toBe(true);
      expect(row.attendance.size).toBe(0);
    }
  });

  it('loads the tenant classes for the filter options without failing the page', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return success({ items: [], pagination: pagination({ total_items: 0 }) });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
        return success({
          items: [
            { id: 'class-1', name: 'Matematika Dasar' },
            { id: '', name: 'Tanpa ID' },
          ],
          pagination: pagination({ total_items: 2 }),
        });
      }
      return undefined;
    });

    const result = await getTutorSessions({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.classes).toEqual([{ id: 'class-1', name: 'Matematika Dasar' }]);
    }
  });

  it('reads the tutor list for the substitute-tutor select', async () => {
    const tutorId = 'aaaaaaaa-1111-4222-8333-444455556666';
    installFetch(
      sessionsRoute([], [
        { id: tutorId, first_name: 'Budi', last_name: 'Hartono', email: 'budi@example.com' },
      ])
    );

    const result = await getTutorSessions({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.tutors).toEqual([
        { id: tutorId, name: 'Budi Hartono', email: 'budi@example.com' },
      ]);
    }

    const tutorCall = requestedPaths().find((path) =>
      path.startsWith(`${GATEWAY_URL}/api/v1/tutors`)
    ) as string;
    const tutorQuery = new URLSearchParams(tutorCall.split('?')[1]);

    expect(tutorQuery.get('page_size')).toBe('100');
    expect(headersOf(tutorCall)).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
  });

  it('degrades to an empty tutor list when the tutor read fails', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return success({ items: [sessionRow()], pagination: pagination() });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions/`) && url.endsWith('/attendees')) {
        return success([]);
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/attendance`)) {
        return success({ items: [], pagination: pagination({ total_items: 0 }) });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
        return success({ items: [], pagination: pagination({ total_items: 0 }) });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/tutors`)) {
        return failure(500, 'tutor list unavailable');
      }
      return undefined;
    });

    const result = await getTutorSessions({});

    // The session list is the primary content: an unreadable tutor list
    // degrades to the dialog's own empty state instead of failing the page.
    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.tutors).toEqual([]);
    }
  });
});
