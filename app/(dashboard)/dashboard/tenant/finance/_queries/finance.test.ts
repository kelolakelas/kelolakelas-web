import { beforeEach, describe, expect, it, vi } from 'vitest';
const { cookieStore } = vi.hoisted(() => ({ cookieStore: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: cookieStore }));
vi.mock('@/lib/gateway', () => ({ getGatewayBaseUrl: () => 'http://gateway.test' }));
import { readAccounts, readLedger, readWallet, readWithdrawals } from './finance';
const response = (status: number, data: unknown, envelope = 'success') => ({
  status, ok: status >= 200 && status < 300, json: async () => ({ status: envelope, data }),
});
beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.mockResolvedValue({ get: (key: string) => ({ value: key === 'auth_token' ? 'token' : 'tenant' }) });
});
describe('finance reads', () => {
  it('reads zero balance and empty lists through cookie auth', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(200, { available_balance: 0, pending_balance: 0 }))
      .mockResolvedValueOnce(response(200, { items: [], pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 } }))
      .mockResolvedValueOnce(response(200, { items: [] }))
      .mockResolvedValueOnce(response(200, { items: [], pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 0 } }));
    vi.stubGlobal('fetch', fetch);
    expect((await readWallet()).state).toBe('ok');
    expect((await readLedger(1)).state).toBe('ok');
    expect((await readAccounts()).state).toBe('ok');
    expect((await readWithdrawals(1)).state).toBe('ok');
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: 'no-store', headers: { Authorization: 'Bearer token', 'X-Tenant-ID': 'tenant' } });
  });
  it('distinguishes forbidden, outage, and malformed successful envelopes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(403, null, 'error')).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response(200, null)));
    expect(await readWallet()).toEqual({ state: 'forbidden' });
    expect(await readWallet()).toEqual({ state: 'error' });
    expect(await readWallet()).toEqual({ state: 'error' });
  });
  it('does not render malformed ledger as partial financial data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { items: [{ id: '1', amount: '99' }], pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 } })));
    expect(await readLedger(1)).toEqual({ state: 'error' });
  });
});
