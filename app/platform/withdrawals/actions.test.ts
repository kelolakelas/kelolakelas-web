import { beforeEach, describe, expect, it, vi } from 'vitest';
const { cookieGet, fetchMock, revalidate } = vi.hoisted(() => ({ cookieGet: vi.fn(), fetchMock: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
vi.mock('@/lib/gateway', () => ({ getGatewayBaseUrl: () => 'http://gateway' }));
import { decideWithdrawal } from './actions';
const token = (claims: object) => `header.${btoa(JSON.stringify(claims))}.signature`;
const admin = token({ is_platform_admin: true, platform_factor_version: 1 });
const id = '123e4567-e89b-42d3-a456-426614174000';
const initial = { status: 0, message: '' };
function form(decision: string, detail: string, withdrawalId = id) {
  const f = new FormData(); f.set('id', withdrawalId); f.set('decision', decision);
  f.set(decision === 'paid' ? 'transfer_reference' : 'reason', detail); return f;
}
describe('platform withdrawal decisions', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); cookieGet.mockReturnValue({ value: admin }); });
  it('records a paid transfer and refreshes the pending queue', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    expect((await decideWithdrawal(initial, form('paid', '  BANK-123  '))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(`http://gateway/api/v1/platform/withdrawals/${id}/paid`, expect.objectContaining({ method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ transfer_reference: 'BANK-123' }) }));
    expect(revalidate).toHaveBeenCalledWith('/platform/withdrawals');
  });
  it('rejects with a required reason and refreshes the queue', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    expect((await decideWithdrawal(initial, form('reject', '  Incorrect destination  '))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(`http://gateway/api/v1/platform/withdrawals/${id}/reject`, expect.objectContaining({ body: JSON.stringify({ reason: 'Incorrect destination' }) }));
    expect(revalidate).toHaveBeenCalledWith('/platform/withdrawals');
  });
  it('validates empty, oversized, and invalid inputs before dispatch', async () => {
    for (const intent of [form('reject', '  '), form('reject', 'a'.repeat(2001)), form('paid', '  '), form('paid', 'a'.repeat(256)), form('paid', 'ref', 'not-uuid'), form('paid', 'ref', '00000000-0000-0000-0000-000000000000'), form('other', 'ref')]) {
      expect((await decideWithdrawal(initial, intent)).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('distinguishes a competing admin decision from a reused transfer reference', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: 'Withdrawal already processed' }) }).mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: 'Transfer reference already used' }) });
    expect((await decideWithdrawal(initial, form('paid', 'REF'))).message).toContain('another admin');
    expect((await decideWithdrawal(initial, form('paid', 'REF'))).message).toContain('already used');
    expect(revalidate).not.toHaveBeenCalled();
  });
  it('fails closed on missing, tenant, or expired platform credentials and upstream errors', async () => {
    cookieGet.mockReturnValue(undefined);
    expect((await decideWithdrawal(initial, form('paid', 'REF'))).status).toBe(401);
    cookieGet.mockReturnValue({ value: token({ tenant_id: 'tenant' }) });
    expect((await decideWithdrawal(initial, form('paid', 'REF'))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    cookieGet.mockReturnValue({ value: admin });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 }).mockRejectedValueOnce(new Error('offline'));
    expect((await decideWithdrawal(initial, form('paid', 'REF'))).message).toContain('Session expired');
    expect((await decideWithdrawal(initial, form('paid', 'REF'))).message).toContain('Refresh the queue');
    expect(revalidate).not.toHaveBeenCalled();
  });
});
