import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest, mockWallet, mockRevalidate } = vi.hoisted(() => ({
  mockRequest: vi.fn(), mockWallet: vi.fn(), mockRevalidate: vi.fn(),
}));
vi.mock('../_queries/finance', () => ({ financeRequest: mockRequest, readWallet: mockWallet }));
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidate }));
import { addAccount, cancelWithdrawal, requestWithdrawal } from './actions';
import { initialActionState, FINANCE_PATH } from '../_lib/finance';

const id = '123e4567-e89b-42d3-a456-426614174000';
const withdrawal = (amount: string, key = id) => {
  const form = new FormData(); form.set('amount', amount); form.set('idempotency_key', key); return form;
};
beforeEach(() => {
  vi.clearAllMocks();
  mockWallet.mockResolvedValue({ state: 'ok', data: { available_balance: 10000, pending_balance: 0 } });
  mockRequest.mockResolvedValue({ ok: true, status: 201 });
});
describe('finance mutations', () => {
  it('submits an account, then a withdrawal with stable key, and refreshes the page', async () => {
    const form = new FormData(); form.set('bank_code', 'BCA'); form.set('account_number', '12345678'); form.set('account_name', 'Test');
    expect((await addAccount(initialActionState, form)).success).toBe(true);
    const intent = withdrawal('5000');
    expect((await requestWithdrawal(initialActionState, intent)).success).toBe(true);
    expect(mockRequest).toHaveBeenNthCalledWith(2, 'withdrawals', { method: 'POST', body: JSON.stringify({ amount: 5000, idempotency_key: id }) });
    expect(mockRevalidate).toHaveBeenCalledWith(FINANCE_PATH);
  });
  it('rejects invalid input and insufficient balance without a write', async () => {
    expect((await requestWithdrawal(initialActionState, withdrawal('0'))).success).toBe(false);
    expect((await requestWithdrawal(initialActionState, withdrawal('10001'))).message).toContain('Saldo tersedia tidak cukup');
    expect((await requestWithdrawal(initialActionState, withdrawal('1', 'invalid'))).success).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
  });
  it.each([
    ['Insufficient available balance', 'Saldo tersedia tidak cukup'],
    ['Tenant has no primary bank account', 'Belum ada rekening utama'],
    ['An open withdrawal request already exists', 'pengajuan penarikan terbuka'],
  ])('maps backend %s without exposing raw text', async (message, expected) => {
    mockRequest.mockResolvedValue({ ok: false, status: 422, message });
    expect((await requestWithdrawal(initialActionState, withdrawal('100'))).message).toContain(expected);
    expect(mockRevalidate).not.toHaveBeenCalled();
  });
  it('rejects forbidden writes and malformed account data', async () => {
    expect((await addAccount(initialActionState, new FormData())).success).toBe(false);
    mockRequest.mockResolvedValue({ ok: false, status: 403 });
    const form = new FormData(); form.set('bank_code', 'BCA'); form.set('account_number', '12345678'); form.set('account_name', 'Test');
    expect((await addAccount(initialActionState, form)).message).toContain('tidak memiliki akses');
  });
  it('cancels only a valid id and refreshes balance on the next read', async () => {
    const invalid = new FormData(); invalid.set('id', '../bad');
    expect((await cancelWithdrawal(initialActionState, invalid)).success).toBe(false);
    const form = new FormData(); form.set('id', id);
    expect((await cancelWithdrawal(initialActionState, form)).success).toBe(true);
    expect(mockRequest).toHaveBeenCalledWith(`withdrawals/${id}`, { method: 'DELETE' });
    expect(mockRevalidate).toHaveBeenCalledWith(FINANCE_PATH);
  });
});
