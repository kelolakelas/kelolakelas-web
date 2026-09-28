import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListPagination } from '@/lib/list-envelope';

/**
 * Integration test for the tenant schedule-request work queue reader
 * (KEL-110).
 *
 * The module cannot reach its real collaborators here: `next/headers` needs a
 * request scope, and the gateway reads go out over `fetch`. Both are replaced
 * with stand-ins that keep the observable contract:
 *
 * - the cookie store answers the two cookie names the reader looks up,
 * - `fetch` is a stub routed by URL, so the test asserts exactly which
 *   academic requests a given page state produces.
 *
 * The behaviours pinned here are the ones the acceptance criteria name:
 * authorization failures surface as `forbidden` (not as a technical error),
 * the status filter is forwarded to the backend rather than applied in the
 * browser, class/student labels degrade to placeholders instead of taking the
 * page down, and a missing student never fails the queue.
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

const { getTenantScheduleRequests } = await import('./queries');

const GATEWAY_URL = 'http://gateway.test';

const REQUEST_ID = '9a1c3e5f-2b4d-4e6f-8a0b-1c2d3e4f5a6b';
const CLASS_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const STUDENT_ID = '7c2e4d1b-5b8f-4d2e-8d3f-7a1c9e6b4f22';

function pagination(overrides: Partial<ListPagination> = {}): ListPagination {
  return { page: 1, page_size: 20, total_items: 1, total_pages: 1, ...overrides };
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

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    tenant_id: 'tenant-1',
    class_id: CLASS_ID,
    student_id: STUDENT_ID,
    parent_id: 'parent-1',
    parent_email: 'ortu@example.com',
    billing_cycle: 'monthly',
    slots: [{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }],
    note: null,
    status: 'pending',
    rejection_reason: null,
    decided_at: null,
    created_at: '2026-09-20T10:00:00Z',
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

function fullQueue() {
  installFetch((url) => {
    if (url.startsWith(`${GATEWAY_URL}/api/v1/schedule-requests`)) {
      return success({ items: [request()], pagination: pagination() });
    }
    if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
      return success({
        items: [{ id: CLASS_ID, name: 'Matematika Private' }],
        pagination: pagination(),
      });
    }
    if (url === `${GATEWAY_URL}/api/v1/students/${STUDENT_ID}`) {
      return success({ id: STUDENT_ID, parent_id: 'parent-1', first_name: 'Ayu', last_name: 'Lestari' });
    }
    return undefined;
  });
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

describe('getTenantScheduleRequests', () => {
  it('reads pending requests with the session credentials and labels every row', async () => {
    fullQueue();

    const result = await getTenantScheduleRequests({}, { status: 'pending' });

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.total).toBe(1);
      const [row] = result.data.rows;
      expect(row.request.id).toBe(REQUEST_ID);
      expect(row.request.status).toBe('pending');
      expect(row.className).toBe('Matematika Private');
      expect(row.student?.first_name).toBe('Ayu');
    }

    const listCall = requestedPaths().find((path) => path.includes('/api/v1/schedule-requests'));
    expect(listCall).toContain('status=pending');
    expect(headersOf(listCall as string)).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
  });

  it('accepts the enveloped list the academic service answers', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedule-requests`)) {
        return success({
          items: [request(), request({ id: '5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d1c', status: 'approved' })],
          pagination: pagination({ total_items: 2 }),
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
        return success({ items: [], pagination: pagination() });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/students/`)) {
        return failure(404, 'no such student');
      }
      return undefined;
    });

    const result = await getTenantScheduleRequests({}, { status: '' });

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.total).toBe(2);
      // The class list answered nothing and every student lookup 404'd, so
      // both rows degrade to placeholders instead of failing the page.
      expect(result.data.rows[0].className).toBeNull();
      expect(result.data.rows[0].student).toBeNull();
    }

    const listCall = requestedPaths().find((path) => path.includes('/api/v1/schedule-requests'));
    expect(listCall).not.toContain('status=');
  });

  it('reports a refused list read as forbidden without a technical message', async () => {
    // 401 covers an expired session, 403 a member without `enrollment:read`.
    for (const status of [401, 403]) {
      installFetch((url) => {
        if (url.startsWith(`${GATEWAY_URL}/api/v1/schedule-requests`)) {
          return failure(status, 'insufficient permission');
        }
        return undefined;
      });

      const result = await getTenantScheduleRequests({}, { status: 'pending' });

      expect(result.error).toBe('forbidden');
      if (result.error === 'forbidden') {
        expect(result.message).toContain('enrollment:read');
        // The backend's own wording must not leak into the tenant's screen.
        expect(result.message).not.toContain('insufficient permission');
      }
      // A refused list read must not trigger label lookups.
      expect(requestedPaths().some((path) => path.includes('/api/v1/classes'))).toBe(false);
    }
  });

  it('reports a successful HTTP answer that is not a success envelope as an api error', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedule-requests`)) {
        return failure(500, 'internal error');
      }
      return undefined;
    });

    const result = await getTenantScheduleRequests({}, { status: 'pending' });

    expect(result.error).toBe('api');
    if (result.error === 'api') {
      expect(result.message).not.toContain('internal error');
    }
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;
    installFetch(() => undefined);

    const result = await getTenantScheduleRequests({}, { status: 'pending' });

    expect(result.error).toBe('configuration');
    if (result.error === 'configuration') {
      expect(result.message).toContain('GATEWAY_API_URL');
    }
  });

  it('keeps rows whose student lookup fails for a single row', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedule-requests`)) {
        return success({
          items: [
            request(),
            request({ id: '5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d1c', student_id: 'unknown-student' }),
          ],
          pagination: pagination({ total_items: 2 }),
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
        return success({
          items: [{ id: CLASS_ID, name: 'Matematika Private' }],
          pagination: pagination(),
        });
      }
      if (url === `${GATEWAY_URL}/api/v1/students/${STUDENT_ID}`) {
        return success({ id: STUDENT_ID, parent_id: 'parent-1', first_name: 'Ayu', last_name: 'Lestari' });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/students/`)) {
        return failure(404, 'no such student');
      }
      return undefined;
    });

    const result = await getTenantScheduleRequests({}, { status: 'pending' });

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.total).toBe(2);
      expect(result.data.rows[0].student?.first_name).toBe('Ayu');
      // A request-only student the tenant lookup cannot read degrades to the
      // neutral placeholder instead of failing its row.
      expect(result.data.rows[1].student).toBeNull();
      expect(result.data.rows[1].className).toBe('Matematika Private');
    }
  });

  it('drops malformed rows instead of failing the queue', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedule-requests`)) {
        return success({ items: [request(), { id: 'broken' }, null], pagination: pagination() });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/classes`)) {
        return success({ items: [], pagination: pagination() });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/students/`)) {
        return failure(404, 'no such student');
      }
      return undefined;
    });

    const result = await getTenantScheduleRequests({}, { status: 'pending' });

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.total).toBe(1);
      expect(result.data.rows[0].request.id).toBe(REQUEST_ID);
    }
  });
});
