import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTenantSalesSummary } from './sales-summary';

/** KEL-58: the dashboard sales summary read. */

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
const idr = { currency: 'IDR', transaction_count: 3, gross_amount: 450000, net_amount: 405000 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function success(data: unknown) {
  return json({ status: 'success', message: 'ok', data });
}

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(response: Response | (() => Promise<Response>)) {
  fetchMock = vi.fn(async () => (typeof response === 'function' ? response() : response));
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

describe('getTenantSalesSummary', () => {
  it('reads the per-currency totals with the session token and tenant, uncached', async () => {
    installFetch(success({ from: '2026-08-29', to: '2026-09-27', totals: [idr, { ...idr, currency: 'usd' }] }));

    const read = await getTenantSalesSummary();

    expect(read).toEqual({
      state: 'ok',
      from: '2026-08-29',
      to: '2026-09-27',
      totals: [idr, { ...idr, currency: 'USD' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${GATEWAY_URL}/api/v1/billing/transactions/summary`);
    expect(init).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      headers: { Authorization: 'Bearer session-token', 'X-Tenant-ID': 'tenant-1' },
    });
  });

  it('keeps an empty period apart from a failure', async () => {
    installFetch(success({ from: '2026-08-29', to: '2026-09-27', totals: [] }));
    await expect(getTenantSalesSummary()).resolves.toEqual({ state: 'ok', from: '2026-08-29', to: '2026-09-27', totals: [] });
  });

  it('reports a member without billing:read as forbidden', async () => {
    installFetch(json({ status: 'error', message: 'Permission denied', data: null }, 403));
    await expect(getTenantSalesSummary()).resolves.toEqual({ state: 'forbidden' });
  });

  it.each([401, 500, 503])('reports HTTP %s as an error', async (status) => {
    installFetch(json({ status: 'error', data: null }, status));
    await expect(getTenantSalesSummary()).resolves.toEqual({ state: 'error' });
  });

  it('reports a network failure as an error instead of throwing', async () => {
    installFetch(() => Promise.reject(new TypeError('fetch failed')));
    await expect(getTenantSalesSummary()).resolves.toEqual({ state: 'error' });
  });

  it.each([
    ['a non-success envelope', { status: 'error', data: null }],
    ['a missing totals list', { status: 'success', data: { from: '2026-08-29', to: '2026-09-27' } }],
    ['a malformed date', { status: 'success', data: { from: '29/08/2026', to: '2026-09-27', totals: [] } }],
    // One bad bucket fails the whole read: dropping it would show a smaller total than the real one.
    ['a malformed currency', { status: 'success', data: { from: '2026-08-29', to: '2026-09-27', totals: [{ ...idr, currency: '' }] } }],
    ['a non-integer amount', { status: 'success', data: { from: '2026-08-29', to: '2026-09-27', totals: [{ ...idr, gross_amount: '450000' }] } }],
    ['a negative amount', { status: 'success', data: { from: '2026-08-29', to: '2026-09-27', totals: [{ ...idr, net_amount: -1 }] } }],
  ])('reports %s as an error', async (_label, body) => {
    installFetch(json(body));
    await expect(getTenantSalesSummary()).resolves.toEqual({ state: 'error' });
  });
});
