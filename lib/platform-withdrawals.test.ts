import { beforeEach, describe, expect, it, vi } from 'vitest';
const { cookieGet, fetchMock } = vi.hoisted(() => ({ cookieGet: vi.fn(), fetchMock: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock('@/lib/gateway', () => ({ getGatewayBaseUrl: () => 'http://gateway' }));
import { readPlatformWithdrawalHistory, readPlatformWithdrawals } from './platform-withdrawals';
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
  describe('decision history', () => {
    const paid = { id: 'paid-1', tenant_id: 'tenant-1', amount: 100000, admin_fee: 1000, net_amount: 99000, status: 'paid', bank_code: 'BCA', account_number: '12345678', account_name: 'Holder', requested_at: '2026-10-01', decided_by: 'admin-1', decided_at: '2026-10-02', transfer_reference: 'REF-1' };
    const rejected = { id: 'rej-1', tenant_id: 'tenant-2', amount: 50000, admin_fee: 500, net_amount: 49500, status: 'rejected', bank_code: 'BRI', account_number: '87654321', account_name: 'Other', requested_at: '2026-10-01', decided_by: 'admin-2', decided_at: '2026-10-02', reject_reason: 'Invalid destination' };
    it('reads paid and rejected decisions with the full destination', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data: { items: [paid, rejected], pagination: { page: 1, total_pages: 1, total_items: 2 } } }) });
      const result = await readPlatformWithdrawalHistory(1);
      expect(result.status).toBe(200);
      expect(result.data?.items.map(item => item.status)).toEqual(['paid', 'rejected']);
      expect(result.data?.items[0].account_number).toBe('12345678');
      expect(fetchMock).toHaveBeenCalledWith('http://gateway/api/v1/platform/withdrawals?status=decided&page=1', { headers: { Authorization: `Bearer ${admin}` }, cache: 'no-store' });
    });
    it('reads empty history and rejects sessions, failures, and malformed decisions', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data: queue }) });
      expect((await readPlatformWithdrawalHistory(1)).data?.items).toEqual([]);
      fetchMock.mockReset();
      vi.stubGlobal('fetch', fetchMock);
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'success', data: { items: [{ ...paid, status: 'requested' }], pagination: queue.pagination } }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'success', data: { items: [{ ...paid, transfer_reference: undefined }], pagination: queue.pagination } }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'success', data: { items: [{ ...rejected, reject_reason: undefined }], pagination: queue.pagination } }) }).mockRejectedValueOnce(new Error('offline'));
      expect((await readPlatformWithdrawalHistory(1)).status).toBe(503);
      for (let i = 0; i < 4; i++) expect((await readPlatformWithdrawalHistory(1)).status).toBe(503);
      fetchMock.mockClear();
      cookieGet.mockReturnValue(undefined);
      expect((await readPlatformWithdrawalHistory(1)).status).toBe(401);
      cookieGet.mockReturnValue({ value: token({ tenant_id: 'tenant' }) });
      expect((await readPlatformWithdrawalHistory(1)).status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
