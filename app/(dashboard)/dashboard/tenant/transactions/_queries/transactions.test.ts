import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTenantTransactions } from './transactions';

/**
 * KEL-148 tenant transaction list reader.
 *
 * `next/headers` needs a request scope and the gateway reads go out over
 * `fetch`, so both are replaced with stand-ins: the cookie store answers the
 * two cookie names the reader looks up, and `fetch` is a stub routed by URL.
 *
 * The behaviours pinned here are the ones the acceptance criteria name:
 * authorization failures surface as `forbidden` (not as a technical error),
 * the list carries only the vocabulary the billing `List` handler
 * understands (always `date_by=paid_at`, strict `YYYY-MM-DD`, an explicit
 * status so the export cannot disagree), rows that fail normalisation are
 * skipped rather than failing the list, and a hand-typed bad filter produces
 * `invalid_filter` without any request.
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

const GATEWAY_URL = 'http://gateway.test';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    merchant_order_id: 'order-1',
    status: 'paid',
    currency: 'IDR',
    gross_amount: 180000,
    platform_fee: 10000,
    payment_gateway_fee: 4000,
    net_amount: 166000,
    paid_at: '2026-09-20T03:00:00Z',
    created_at: '2026-09-19T10:00:00Z',
    ...overrides,
  };
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

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  savedGatewayUrl = process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = GATEWAY_URL;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (savedGatewayUrl === undefined) {
    delete process.env.GATEWAY_API_URL;
  } else {
    process.env.GATEWAY_API_URL = savedGatewayUrl;
  }
});

describe('getTenantTransactions', () => {
  it('requests the paid last-30-days list on the paid date with the session token', async () => {
    installFetch(
      success({
        items: [row()],
        pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 },
      }),
    );

    const result = await getTenantTransactions({}, new Date('2026-09-27T10:00:00Z'));

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;
    expect(result.data.filters).toEqual({
      page: 1,
      status: 'paid',
      search: '',
      date_from: '2026-08-29',
      date_to: '2026-09-27',
    });
    expect(result.data.rows).toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(`${GATEWAY_URL}/api/v1/billing/transactions`);
    expect(parsed.searchParams.get('date_by')).toBe('paid_at');
    expect(parsed.searchParams.get('status')).toBe('paid');
    expect(parsed.searchParams.get('date_from')).toBe('2026-08-29');
    expect(parsed.searchParams.get('date_to')).toBe('2026-09-27');
    expect(parsed.searchParams.get('page')).toBe('1');
    expect(parsed.searchParams.get('page_size')).toBe('20');
    expect(init).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: 'Bearer session-token', 'X-Tenant-ID': 'tenant-1' },
    });
  });

  it('forwards an explicit status, search, page, and range', async () => {
    installFetch(
      success({
        items: [],
        pagination: { page: 2, page_size: 20, total_items: 0, total_pages: 0 },
      }),
    );

    const result = await getTenantTransactions(
      { status: 'pending', search: 'order-9', page: '2', date_from: '2026-09-01', date_to: '2026-09-10' },
      new Date('2026-09-27T10:00:00Z'),
    );

    expect(result.error).toBeNull();
    const params = new URLSearchParams(String(fetchMock.mock.calls[0][0]).split('?')[1]);
    expect(params.get('status')).toBe('pending');
    expect(params.get('search')).toBe('order-9');
    expect(params.get('page')).toBe('2');
    expect(params.get('date_from')).toBe('2026-09-01');
    expect(params.get('date_to')).toBe('2026-09-10');
  });

  it('reports a member without billing:read as forbidden', async () => {
    installFetch(failure(403, 'Permission denied'));

    await expect(
      getTenantTransactions({ date_from: '2026-09-01', date_to: '2026-09-10' }),
    ).resolves.toMatchObject({ data: null, error: 'forbidden' });
  });

  it('reports a backend failure as a plain api error', async () => {
    installFetch(failure(500, 'Failed to fetch transactions'));

    await expect(
      getTenantTransactions({ date_from: '2026-09-01', date_to: '2026-09-10' }),
    ).resolves.toMatchObject({ data: null, error: 'api' });
  });

  it('skips unusable rows instead of failing the list', async () => {
    installFetch(
      success({
        items: [row(), { id: 'broken' }, row({ id: 'tx-2', merchant_order_id: 'order-2' })],
        pagination: { page: 1, page_size: 20, total_items: 3, total_pages: 1 },
      }),
    );

    const result = await getTenantTransactions({ date_from: '2026-09-01', date_to: '2026-09-10' });

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;
    expect(result.data.rows.map((entry) => entry.id)).toEqual(['tx-1', 'tx-2']);
  });

  it('rejects a hand-typed bad filter without any request', async () => {
    installFetch(success({ items: [], pagination: {} }));

    await expect(
      getTenantTransactions({ date_from: '2026-09-01', date_to: '2026-09-10', status: 'all' }),
    ).resolves.toEqual({ data: null, error: 'invalid_filter' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
