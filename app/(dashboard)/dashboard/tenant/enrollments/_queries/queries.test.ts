import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListPagination } from '@/lib/list-envelope';

/**
 * Integration test for the tenant enrollment overview reader (KEL-33).
 *
 * The module cannot reach its real collaborators here: `next/headers` needs a
 * request scope, and the gateway reads go out over `fetch`. Both are replaced
 * with stand-ins that keep the observable contract:
 *
 * - the cookie store answers the two cookie names the reader looks up,
 * - `fetch` is a stub routed by URL, so the test asserts exactly which academic
 *   and billing requests a given page state produces.
 *
 * The behaviours pinned here are the ones the acceptance criteria name:
 * authorization failures surface as `forbidden` (not as a technical error), the
 * status filter is forwarded to the backend rather than applied in the browser,
 * and a payment lookup that fails degrades to "no payment shown" instead of
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

const { getTenantEnrollments } = await import('./queries');

const GATEWAY_URL = 'http://gateway.test';

const EMAIL_ENROLLMENT_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const SECOND_ENROLLMENT_ID = '8d2c7e10-9f3b-4a5c-b6d7-1e2f3a4b5c6d';

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

describe('getTenantEnrollments', () => {
  it('reads enrollments and schedules with the session credentials', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
        return success({ items: [{ id: EMAIL_ENROLLMENT_ID, status: 'active' }], pagination: pagination() });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
        return success({ items: [], pagination: pagination() });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/billing/transactions`)) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTenantEnrollments({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0].enrollment.id).toBe(EMAIL_ENROLLMENT_ID);
    }

    const enrollmentCall = requestedPaths().find((path) => path.includes('/api/v1/enrollments'));
    expect(headersOf(enrollmentCall as string)).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
  });

  it('reports a refused enrollment read as forbidden without a technical message', async () => {
    // 401 covers an expired session, 403 a member without `enrollment:read`.
    for (const status of [401, 403]) {
      installFetch((url) => {
        if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
          return failure(status, 'insufficient permission');
        }
        if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
          return success({ items: [], pagination: pagination() });
        }
        return undefined;
      });

      const result = await getTenantEnrollments({});

      expect(result.error).toBe('forbidden');
      if (result.error === 'forbidden') {
        expect(result.message).toContain('enrollment:read');
        // The backend's own wording must not leak into the tenant's screen.
        expect(result.message).not.toContain('insufficient permission');
      }
    }
  });

  it('reports a successful HTTP answer that is not a success envelope as an api error', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
        return failure(500, 'internal error');
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTenantEnrollments({});

    expect(result.error).toBe('api');
    if (result.error === 'api') {
      expect(result.message).not.toContain('internal error');
    }
    // A failed enrollment read must not trigger payment lookups.
    expect(requestedPaths().some((path) => path.includes('billing/transactions'))).toBe(false);
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;
    installFetch(() => undefined);

    const result = await getTenantEnrollments({});

    expect(result.error).toBe('configuration');
    if (result.error === 'configuration') {
      expect(result.message).toContain('GATEWAY_API_URL');
    }
  });

  it('refuses an invalid filter without calling the backend', async () => {
    installFetch(() => undefined);

    const result = await getTenantEnrollments({ status: 'open' });

    expect(result).toEqual({ data: null, error: 'invalid_filter' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the accepted status filter and page to the backend', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
        return success({ items: [], pagination: pagination({ page: 2, total_pages: 3 }) });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTenantEnrollments({ status: 'dropped', page: '2' });

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.pagination.total_pages).toBe(3);
    }

    const enrollmentCall = requestedPaths().find(
      (path) => path.includes('/api/v1/enrollments')
    ) as string;
    const query = new URLSearchParams(enrollmentCall.split('?')[1]);

    expect(query.get('status')).toBe('dropped');
    expect(query.get('page')).toBe('2');
    expect(query.get('page_size')).toBe('20');
  });

  it('joins each enrollment to its own newest transaction', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
        return success({
          items: [
            { id: EMAIL_ENROLLMENT_ID, status: 'active' },
            { id: SECOND_ENROLLMENT_ID, status: 'pending' },
          ],
          pagination: pagination({ total_items: 2 }),
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
        return success({ items: [], pagination: pagination() });
      }
      if (url.includes('billing/transactions')) {
        const query = new URLSearchParams(url.split('?')[1]);
        const enrollmentId = query.get('enrollment_id');

        if (enrollmentId === EMAIL_ENROLLMENT_ID) {
          return success({
            items: [
              { id: 'tx-newest', enrollment_id: EMAIL_ENROLLMENT_ID, status: 'paid', gross_amount: 150000 },
              { id: 'tx-older', enrollment_id: EMAIL_ENROLLMENT_ID, status: 'expired' },
            ],
            pagination: pagination(),
          });
        }

        // The second enrollment has no invoice at all, which is a legitimate
        // state when invoice creation failed.
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTenantEnrollments({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      const [first, second] = result.data.rows;

      expect(first.transaction?.id).toBe('tx-newest');
      expect(second.transaction).toBeUndefined();
    }
  });

  it('looks up exactly one payment per enrollment and skips unusable ids', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
        return success({
          items: [
            { id: EMAIL_ENROLLMENT_ID, status: 'active' },
            { id: 'not-a-uuid', status: 'active' },
          ],
          pagination: pagination({ total_items: 2 }),
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
        return success({ items: [], pagination: pagination() });
      }
      if (url.includes('billing/transactions')) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    await getTenantEnrollments({});

    const billingCalls = requestedPaths().filter((path) => path.includes('/billing/transactions'));

    expect(billingCalls).toHaveLength(1);
    expect(billingCalls[0]).toContain(`enrollment_id=${EMAIL_ENROLLMENT_ID}`);
    expect(billingCalls[0]).toContain('page_size=1');
  });

  it('keeps the enrollment list when a single payment lookup fails', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
        return success({
          items: [
            { id: EMAIL_ENROLLMENT_ID, status: 'active' },
            { id: SECOND_ENROLLMENT_ID, status: 'pending' },
          ],
          pagination: pagination({ total_items: 2 }),
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
        return success({ items: [], pagination: pagination() });
      }
      if (url.includes('billing/transactions')) {
        const query = new URLSearchParams(url.split('?')[1]);

        if (query.get('enrollment_id') === EMAIL_ENROLLMENT_ID) {
          return failure(500, 'billing unavailable');
        }

        return success({
          items: [
            { id: 'tx-2', enrollment_id: SECOND_ENROLLMENT_ID, status: 'pending' },
          ],
          pagination: pagination(),
        });
      }
      return undefined;
    });

    const result = await getTenantEnrollments({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      const rows = result.data.rows;

      expect(rows).toHaveLength(2);
      expect(rows[0].transaction).toBeUndefined();
      expect(rows[1].transaction?.id).toBe('tx-2');
    }
  });

  it('marks a payment refused with 403 as unavailable to the role, not as missing', async () => {
    // KEL-57: a member without `billing:read` is refused by billing. Other
    // failures keep degrading to "no payment to show".
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
        return success({
          items: [
            { id: EMAIL_ENROLLMENT_ID, status: 'active' },
            { id: SECOND_ENROLLMENT_ID, status: 'pending' },
          ],
          pagination: pagination({ total_items: 2 }),
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
        return success({ items: [], pagination: pagination() });
      }
      if (url.includes('billing/transactions')) {
        const query = new URLSearchParams(url.split('?')[1]);

        return query.get('enrollment_id') === EMAIL_ENROLLMENT_ID
          ? failure(403, 'insufficient permission')
          : failure(503, 'Authorization service unavailable');
      }
      return undefined;
    });

    const result = await getTenantEnrollments({});

    // The enrollment list itself stays readable.
    expect(result.error).toBeNull();
    if (result.error === null) {
      const [refused, unavailable] = result.data.rows;

      expect(refused.paymentForbidden).toBe(true);
      expect(refused.transaction).toBeUndefined();
      expect(unavailable.paymentForbidden).toBeUndefined();
      expect(unavailable.transaction).toBeUndefined();
    }
  });

  it('attaches the schedule referenced by the enrollment', async () => {
    const scheduleId = 'c0ffee00-1111-4222-8333-444455556666';

    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
        return success({
          items: [
            { id: EMAIL_ENROLLMENT_ID, status: 'active', schedule_id: scheduleId },
            { id: SECOND_ENROLLMENT_ID, status: 'active' },
          ],
          pagination: pagination({ total_items: 2 }),
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
        return success({
          items: [
            {
              id: scheduleId,
              day_of_week: 3,
              start_time: '15:30:00',
              end_time: '17:00:00',
            },
          ],
          pagination: pagination(),
        });
      }
      if (url.includes('billing/transactions')) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTenantEnrollments({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      const [scheduled, unscheduled] = result.data.rows;

      expect(scheduled.schedule?.id).toBe(scheduleId);
      expect(unscheduled.schedule).toBeUndefined();
    }
  });

  it('still lists enrollments when the schedule read fails', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
        return success({
          items: [{ id: EMAIL_ENROLLMENT_ID, status: 'active', schedule_id: 'missing' }],
          pagination: pagination(),
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
        return failure(500, 'schedule read failed');
      }
      if (url.includes('billing/transactions')) {
        return success({ items: [], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTenantEnrollments({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0].schedule).toBeUndefined();
    }
  });

  it('keeps rows when a payment payload is not an envelope', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments`)) {
        return success({
          items: [{ id: EMAIL_ENROLLMENT_ID, status: 'active' }],
          pagination: pagination(),
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/schedules`)) {
        return success({ items: [], pagination: pagination() });
      }
      if (url.includes('billing/transactions')) {
        return new Response(JSON.stringify({ status: 'success', data: 'unexpected' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return undefined;
    });

    const result = await getTenantEnrollments({});

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0].transaction).toBeUndefined();
    }
  });
});
