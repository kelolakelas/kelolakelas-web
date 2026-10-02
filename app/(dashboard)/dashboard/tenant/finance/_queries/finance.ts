import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from '@/lib/gateway';
import { type FinanceRead, type Wallet, type LedgerEntry, type BankAccount, type Withdrawal, type Page, isWallet, isPage, isAccounts } from '../_lib/finance';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

export async function financeHeaders(): Promise<Record<string, string>> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value || '';
  const tenant = store.get(TENANT_COOKIE)?.value || '';
  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  // The gateway derives the tenant from the JWT; this cookie is only a routing hint.
  if (tenant) headers['X-Tenant-ID'] = tenant;
  return headers;
}

export async function financeRequest(path: string, options: RequestInit = {}): Promise<{ status: number; data: unknown; message: unknown; ok: boolean }> {
  const response = await fetch(`${getGatewayBaseUrl()}/api/v1/billing/${path}`, {
    ...options, headers: await financeHeaders(), cache: 'no-store',
  });
  const body: unknown = await response.json().catch(() => null);
  const envelope = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  return { status: response.status, ok: response.ok && envelope?.status === 'success', data: envelope?.data, message: envelope?.message };
}

async function read<T>(path: string, check: (data: unknown) => data is T): Promise<FinanceRead<T>> {
  try {
    const response = await financeRequest(path);
    if (response.status === 401 || response.status === 403) return { state: 'forbidden' };
    if (!response.ok || !check(response.data)) return { state: 'error' };
    return { state: 'ok', data: response.data };
  } catch { return { state: 'error' }; }
}
export const readWallet = () => read<Wallet>('wallet', isWallet);
export const readLedger = (page: number) => read<Page<LedgerEntry>>(`ledger?page=${page}`, (data): data is Page<LedgerEntry> => isPage(data) && data.items.every((item) => {
  const entry = item as LedgerEntry;
  return typeof entry.id === 'string' && typeof entry.entry_type === 'string' && Number.isSafeInteger(entry.amount) && typeof entry.created_at === 'string';
}));
export const readAccounts = () => read<{ items: BankAccount[] }>('bank-accounts', isAccounts);
export const readWithdrawals = (page: number) => read<Page<Withdrawal>>(`withdrawals?page=${page}`, (data): data is Page<Withdrawal> => isPage(data) && data.items.every((item) => {
  const withdrawal = item as Withdrawal;
  return typeof withdrawal.id === 'string' && Number.isSafeInteger(withdrawal.amount) && typeof withdrawal.status === 'string' && typeof withdrawal.account_number === 'string' && typeof withdrawal.requested_at === 'string';
}));
