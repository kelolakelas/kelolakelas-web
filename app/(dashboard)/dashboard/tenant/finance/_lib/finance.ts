export const FINANCE_PATH = '/dashboard/tenant/finance';
export type FinanceRead<T> = { state: 'ok'; data: T } | { state: 'forbidden' | 'error' };
export interface Wallet { available_balance: number; pending_balance: number }
export interface Pagination { page: number; page_size: number; total_items: number; total_pages: number }
export interface LedgerEntry { id: string; entry_type: string; amount: number; description?: string | null; created_at: string }
export interface BankAccount { id: string; bank_code: string; account_name: string; account_number: string; is_primary: boolean }
export interface Withdrawal { id: string; amount: number; status: string; bank_code: string; account_number: string; requested_at: string }
export interface Page<T> { items: T[]; pagination: Pagination }
export type FinanceActionState = { success: boolean; message: string };
export const initialActionState: FinanceActionState = { success: false, message: '' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validId(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
export function parsePage(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : 1;
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}
export function validateAccount(form: FormData): { bank_code: string; account_number: string; account_name: string } | null {
  const values = ['bank_code', 'account_number', 'account_name'].map((key) => form.get(key));
  if (values.some((value) => typeof value !== 'string' || !value.trim() || value.trim().length > 255)) return null;
  const [bank_code, account_number, account_name] = values as string[];
  return { bank_code: bank_code.trim(), account_number: account_number.trim(), account_name: account_name.trim() };
}
export function validateWithdrawal(form: FormData): { amount: number; idempotency_key: string } | null {
  const raw = form.get('amount');
  const key = form.get('idempotency_key');
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || !validId(key)) return null;
  const amount = Number(raw);
  if (!Number.isSafeInteger(amount)) return null;
  return { amount, idempotency_key: key };
}
// Never reflect arbitrary backend/proxy text into the financial UI.
export function financeError(message: unknown): string {
  switch (message) {
    case 'Insufficient available balance': return 'Saldo tersedia tidak cukup. Periksa saldo lalu coba lagi.';
    case 'Tenant has no primary bank account': return 'Belum ada rekening utama. Tambahkan rekening terlebih dahulu.';
    case 'An open withdrawal request already exists': return 'Masih ada pengajuan penarikan terbuka. Batalkan atau tunggu diproses.';
    case 'Withdrawal amount below minimum': return 'Nominal penarikan di bawah minimum.';
    case 'Withdrawal cannot be cancelled in its current status': return 'Pengajuan ini tidak dapat dibatalkan pada status saat ini.';
    case 'Bank account is referenced by an active withdrawal': return 'Rekening sedang digunakan oleh pengajuan aktif.';
    default: return 'Permintaan gagal. Muat ulang halaman dan coba lagi.';
  }
}
export const isWallet = (value: unknown): value is Wallet => {
  const v = value as Wallet | null;
  return !!v && Number.isSafeInteger(v.available_balance) && v.available_balance >= 0 && Number.isSafeInteger(v.pending_balance) && v.pending_balance >= 0;
};
export const isPage = (value: unknown): value is Page<unknown> => {
  const v = value as Page<unknown> | null;
  return !!v && Array.isArray(v.items) && !!v.pagination && Number.isSafeInteger(v.pagination.total_pages) && Number.isSafeInteger(v.pagination.total_items);
};
export const isAccounts = (value: unknown): value is { items: BankAccount[] } => {
  const v = value as { items: BankAccount[] } | null;
  return !!v && Array.isArray(v.items) && v.items.every((item) => typeof item.id === 'string' && typeof item.account_number === 'string' && typeof item.bank_code === 'string' && typeof item.account_name === 'string');
};
