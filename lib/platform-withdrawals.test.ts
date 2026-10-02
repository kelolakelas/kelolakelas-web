import { beforeEach, describe, expect, it, vi } from 'vitest';
const { cookieGet, fetchMock } = vi.hoisted(() => ({ cookieGet: vi.fn(), fetchMock: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock('@/lib/gateway', () => ({ getGatewayBaseUrl: () => 'http://gateway' }));
import { readPlatformWithdrawals } from './platform-withdrawals';
const token = (claims: object) => `header.${btoa(JSON.stringify(claims))}.signature`;
const admin = token({ is_platform_admin: true, platform_factor_version: 1 });
const queue = { items: [], pagination: { page: 1, total_pages: 0, total_items: 0 } };
describe('platform withdrawal queue', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); cookieGet.mockReturnValue({ value: admin }); });
  it('reads the empty and paginated pending queue without tenant headers', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data: queue }) });
    expect((await readPlatformWithdrawals(1)).data?.items).toEqual([]);
    await readPlatformWithdrawals(2);
    expect(fetchMock).toHaveBeenCalledWith('http://gateway/api/v1/platform/withdrawals?page=2', { headers: { Authorization: `Bearer ${admin}` }, cache: 'no-store' });
  });
  it('does not fetch for missing, tenant, or unverified platform sessions', async () => {
    cookieGet.mockReturnValue(undefined);
    expect((await readPlatformWithdrawals(1)).status).toBe(401);
    for (const claims of [{ tenant_id: 'tenant' }, { is_platform_admin: true }]) {
      cookieGet.mockReturnValue({ value: token(claims) });
      expect((await readPlatformWithdrawals(1)).status).toBe(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not expose a malformed or failed upstream response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 }).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'success', data: { items: [{}], pagination: queue.pagination } }) }).mockRejectedValueOnce(new Error('offline'));
    expect((await readPlatformWithdrawals(1)).status).toBe(403);
    expect((await readPlatformWithdrawals(1)).status).toBe(503);
    expect((await readPlatformWithdrawals(1)).status).toBe(503);
  });
});
