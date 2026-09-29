import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the payment return lookup (KEL-44) against a stubbed
 * gateway. It pins the contract with billing and academic: the parent-scoped
 * billing list is searched, only an exact `merchant_order_id` match counts, the
 * enrollment is read from academic, and every failure is reported without
 * leaking another parent's data.
 */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'auth_token' ? { name, value: 'session-token' } : undefined),
  })),
}));

const { getEnrollmentHistory, getPaymentReturnStatus } = await import('./queries');

const ORDER_ID = '2d8f7a0c-7a0a-4aa8-8e54-000000000001';
const ENROLLMENT_ID = '7c2e4d1b-5b8f-4d2e-8d3f-7a1c9e6b4f22';

type Route = { status: number; body: unknown };

function json(status: number, body: unknown): Route {
  return { status, body };
}

function stubGateway(routes: { transactions?: Route; enrollment?: Route }) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    calls.push({ url: input, init });
    const route = input.includes('/api/v1/billing/transactions') ? routes.transactions : routes.enrollment;
    if (!route) throw new Error(`unexpected gateway call ${input}`);
    return new Response(JSON.stringify(route.body), { status: route.status, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

const transactionList = (items: unknown[]) => json(200, { status: 'success', data: { items, pagination: { page: 1, page_size: 20, total: items.length } } });
const enrollmentBody = (status: string) => json(200, { status: 'success', data: { id: ENROLLMENT_ID, status, class: { name: 'Matematika Dasar' } } });
const tx = (overrides: Record<string, unknown> = {}) => ({ id: ORDER_ID, merchant_order_id: ORDER_ID, enrollment_id: ENROLLMENT_ID, status: 'pending', gross_amount: 150000, currency: 'IDR', ...overrides });

beforeEach(() => {
  vi.stubEnv('GATEWAY_API_URL', 'http://gateway.test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getPaymentReturnStatus (KEL-44)', () => {
  it('reads the parent-scoped billing list and the enrollment with the session token', async () => {
    const calls = stubGateway({ transactions: transactionList([tx()]), enrollment: enrollmentBody('pending') });

    const result = await getPaymentReturnStatus(ORDER_ID);

    expect(result.error).toBeNull();
    expect(result.data?.transaction.status).toBe('pending');
    expect(result.data?.enrollment.status).toBe('pending');
    expect(calls.map((call) => call.url)).toEqual([
      `http://gateway.test/api/v1/billing/transactions?search=${ORDER_ID}&page=1&page_size=20`,
      `http://gateway.test/api/v1/enrollments/${ENROLLMENT_ID}`,
    ]);
    for (const call of calls) {
      expect(new Headers(call.init?.headers).get('authorization')).toBe('Bearer session-token');
      expect(call.init?.cache).toBe('no-store');
    }
  });

  it('returns the newer backend state on the next read (pending, then paid and active)', async () => {
    stubGateway({ transactions: transactionList([tx()]), enrollment: enrollmentBody('pending') });
    expect((await getPaymentReturnStatus(ORDER_ID)).data?.transaction.status).toBe('pending');

    stubGateway({ transactions: transactionList([tx({ status: 'paid', reconciliation_status: 'active' })]), enrollment: enrollmentBody('active') });
    const settled = await getPaymentReturnStatus(ORDER_ID);
    expect(settled.data?.transaction.status).toBe('paid');
    expect(settled.data?.enrollment.status).toBe('active');
  });

  it('accepts only an exact merchant_order_id match from the substring search', async () => {
    const calls = stubGateway({ transactions: transactionList([tx({ merchant_order_id: `renewal-${ORDER_ID}` })]) });

    const result = await getPaymentReturnStatus(ORDER_ID);

    expect(result.error).toBe('not_found');
    expect(calls).toHaveLength(1);
  });

  it('reports an order id outside the parent scope exactly like an unknown one', async () => {
    const calls = stubGateway({ transactions: transactionList([]) });

    const result = await getPaymentReturnStatus(ORDER_ID);

    expect(result).toMatchObject({ data: null, error: 'not_found' });
    expect(calls).toHaveLength(1);
  });

  it('maps an enrollment academic does not return to not_found', async () => {
    stubGateway({ transactions: transactionList([tx()]), enrollment: json(404, { status: 'error', message: 'Enrollment not found', data: null }) });

    expect((await getPaymentReturnStatus(ORDER_ID)).error).toBe('not_found');
  });

  it.each([401, 403])('maps a %s from billing to forbidden', async (status) => {
    stubGateway({ transactions: json(status, { status: 'error', message: 'nope', data: null }) });

    expect((await getPaymentReturnStatus(ORDER_ID)).error).toBe('forbidden');
  });

  it('maps a 401 from academic to forbidden', async () => {
    stubGateway({ transactions: transactionList([tx()]), enrollment: json(401, { status: 'error', message: 'nope', data: null }) });

    expect((await getPaymentReturnStatus(ORDER_ID)).error).toBe('forbidden');
  });

  it.each([
    ['a billing 5xx', { transactions: json(502, { status: 'error', message: 'bad gateway', data: null }) }],
    ['a billing body that is not a success envelope', { transactions: json(200, { status: 'error', data: null }) }],
    ['a transaction without enrollment_id', { transactions: transactionList([tx({ enrollment_id: undefined })]) }],
    ['a transaction whose enrollment_id is not a UUID', { transactions: transactionList([tx({ enrollment_id: '../tenants' })]) }],
    ['an academic 5xx', { transactions: transactionList([tx()]), enrollment: json(503, { status: 'error', message: 'down', data: null }) }],
    ['an enrollment body without a status', { transactions: transactionList([tx()]), enrollment: json(200, { status: 'success', data: { id: ENROLLMENT_ID } }) }],
  ])('reports %s as a retryable api error', async (_label, routes) => {
    stubGateway(routes);

    expect((await getPaymentReturnStatus(ORDER_ID)).error).toBe('api');
  });

  it('reports a missing gateway configuration without calling fetch', async () => {
    vi.stubEnv('GATEWAY_API_URL', '');
    const calls = stubGateway({});

    const result = await getPaymentReturnStatus(ORDER_ID);

    expect(result.error).toBe('configuration');
    expect(calls).toHaveLength(0);
  });
});

/**
 * History lookup (KEL-131) against a stubbed gateway. It pins the list
 * contract with academic and billing: both answer
 * `{status:'success',data:{items,pagination}}` and any payload without an
 * `items` array is a retryable `api` error, never a valid empty list.
 */
describe('getEnrollmentHistory (KEL-131)', () => {
  type HistoryRoute = { status: number; body: unknown };

  function list(status: number, body: unknown): HistoryRoute {
    return { status, body };
  }

  const successList = (items: unknown[]) =>
    list(200, { status: 'success', data: { items, pagination: { page: 1, page_size: 100, total_items: items.length, total_pages: 1 } } });

  const enrollmentRow = (overrides: Record<string, unknown> = {}) => ({
    id: ENROLLMENT_ID,
    status: 'pending',
    class: { name: 'Matematika Dasar' },
    ...overrides,
  });

  function stubHistory(routes: { enrollments?: HistoryRoute; transactions?: HistoryRoute }) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: RequestInit) => {
        calls.push({ url: input, init });
        const route = input.includes('/api/v1/enrollments') ? routes.enrollments : routes.transactions;
        if (!route) throw new Error(`unexpected gateway call ${input}`);
        return new Response(JSON.stringify(route.body), { status: route.status, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    return calls;
  }

  it('unwraps both success envelopes into enrollments and transactions', async () => {
    const calls = stubHistory({
      enrollments: successList([enrollmentRow()]),
      transactions: successList([tx()]),
    });

    const result = await getEnrollmentHistory();

    expect(result.error).toBeNull();
    expect(result.data?.enrollments).toHaveLength(1);
    expect(result.data?.enrollments[0]).toMatchObject({ id: ENROLLMENT_ID, status: 'pending' });
    expect(result.data?.transactions).toHaveLength(1);
    expect(result.data?.transactions[0]).toMatchObject({ merchant_order_id: ORDER_ID });
    expect(calls.map((call) => call.url)).toEqual([
      'http://gateway.test/api/v1/enrollments?page=1&page_size=100',
      'http://gateway.test/api/v1/billing/transactions?page=1&page_size=100',
    ]);
    for (const call of calls) {
      expect(new Headers(call.init?.headers).get('authorization')).toBe('Bearer session-token');
      expect(call.init?.cache).toBe('no-store');
    }
  });

  it('accepts the legacy bare-array list shape for both services', async () => {
    stubHistory({
      enrollments: list(200, { status: 'success', data: [enrollmentRow()] }),
      transactions: list(200, { status: 'success', data: [tx()] }),
    });

    const result = await getEnrollmentHistory();

    expect(result.error).toBeNull();
    expect(result.data?.enrollments).toHaveLength(1);
    expect(result.data?.transactions).toHaveLength(1);
  });

  it('treats one empty list plus one filled list as valid, not an error', async () => {
    stubHistory({ enrollments: successList([]), transactions: successList([tx()]) });

    const result = await getEnrollmentHistory();

    expect(result.error).toBeNull();
    expect(result.data?.enrollments).toEqual([]);
    expect(result.data?.transactions).toHaveLength(1);
  });

  it.each([401, 403])('maps a %s from either list to forbidden', async (status) => {
    stubHistory({ enrollments: list(status, { status: 'error', message: 'nope', data: null }), transactions: successList([tx()]) });
    expect((await getEnrollmentHistory()).error).toBe('forbidden');

    stubHistory({ enrollments: successList([enrollmentRow()]), transactions: list(status, { status: 'error', message: 'nope', data: null }) });
    expect((await getEnrollmentHistory()).error).toBe('forbidden');
  });

  it.each([
    ['an enrollments 5xx', { enrollments: list(500, { status: 'error', message: 'down', data: null }), transactions: successList([tx()]) }],
    ['a transactions 5xx', { enrollments: successList([enrollmentRow()]), transactions: list(502, { status: 'error', message: 'bad gateway', data: null }) }],
    ['a non-success enrollments body', { enrollments: list(200, { status: 'error', message: 'nope', data: null }), transactions: successList([tx()]) }],
    ['a non-success transactions body', { enrollments: successList([enrollmentRow()]), transactions: list(200, { status: 'error', message: 'nope', data: null }) }],
    ['a null enrollments data payload', { enrollments: list(200, { status: 'success', data: null }), transactions: successList([tx()]) }],
    ['a null transactions data payload', { enrollments: successList([enrollmentRow()]), transactions: list(200, { status: 'success', data: null }) }],
    ['an enrollments object without items', { enrollments: list(200, { status: 'success', data: { pagination: {} } }), transactions: successList([tx()]) }],
    ['a transactions object without items', { enrollments: successList([enrollmentRow()]), transactions: list(200, { status: 'success', data: { pagination: {} } }) }],
    ['an enrollments items payload that is not an array', { enrollments: list(200, { status: 'success', data: { items: 'oops' } }), transactions: successList([tx()]) }],
    ['a transactions items payload that is not an array', { enrollments: successList([enrollmentRow()]), transactions: list(200, { status: 'success', data: { items: { id: 'x' } } }) }],
  ])('reports %s as a retryable api error, never a valid empty list', async (_label, routes) => {
    stubHistory(routes);

    const result = await getEnrollmentHistory();

    expect(result).toMatchObject({ data: null, error: 'api' });
  });

  it('reports a missing gateway configuration without calling fetch', async () => {
    vi.stubEnv('GATEWAY_API_URL', '');
    const calls = stubHistory({});

    const result = await getEnrollmentHistory();

    expect(result.error).toBe('configuration');
    expect(calls).toHaveLength(0);
  });
});
