import { cookies } from 'next/headers';
import { callerMatchesScope } from '@/lib/creator-requests';
import { getGatewayBaseUrl } from '@/lib/gateway';

export type PlatformWithdrawal = {
  id: string;
  tenant_id: string;
  amount: number;
  admin_fee: number;
  net_amount: number;
  status: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  requested_at: string;
};

type Queue = { items: PlatformWithdrawal[]; pagination: { page: number; total_pages: number; total_items: number } };
export type WithdrawalRead = { status: number; data: Queue | null; message: string };

export type PlatformWithdrawalDecision = PlatformWithdrawal & {
  status: 'paid' | 'rejected';
  decided_by: string;
  decided_at: string;
  transfer_reference?: string;
  reject_reason?: string;
};

type History = { items: PlatformWithdrawalDecision[]; pagination: { page: number; total_pages: number; total_items: number } };
export type WithdrawalHistoryRead = { status: number; data: History | null; message: string };

const hasWithdrawalFields = (item: PlatformWithdrawal): boolean => !!item && typeof item.id === 'string' && typeof item.tenant_id === 'string' && Number.isSafeInteger(item.amount) && Number.isSafeInteger(item.net_amount) && Number.isSafeInteger(item.admin_fee) && typeof item.bank_code === 'string' && typeof item.account_name === 'string' && typeof item.account_number === 'string' && typeof item.requested_at === 'string';

const isQueueItem = (item: PlatformWithdrawal): boolean => hasWithdrawalFields(item) && item.status === 'requested';

const isHistoryItem = (item: PlatformWithdrawalDecision): boolean => hasWithdrawalFields(item) && (item.status === 'paid' || item.status === 'rejected') && typeof item.decided_by === 'string' && typeof item.decided_at === 'string' && (item.status === 'paid' ? typeof item.transfer_reference === 'string' : typeof item.reject_reason === 'string');

export async function readPlatformWithdrawals(page: number): Promise<WithdrawalRead> {
  const token = (await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  if (!token) return { status: 401, data: null, message: 'Session expired. Sign in again.' };
  if (!callerMatchesScope(token, true)) return { status: 403, data: null, message: 'Platform access required.' };
  const current = Number.isSafeInteger(page) && page > 0 ? page : 1;
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/platform/withdrawals?page=${current}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    if (!response.ok) return { status: response.status, data: null, message: response.status === 401 ? 'Session expired. Sign in again.' : response.status === 403 ? 'Access denied.' : 'Could not load withdrawal queue. Try again.' };
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('status' in body) || body.status !== 'success' || !('data' in body)) throw new Error('Invalid withdrawal response');
    const data = body.data as Queue | null;
    if (!data || !Array.isArray(data.items) || !data.pagination || !Number.isSafeInteger(data.pagination.total_pages) || !Number.isSafeInteger(data.pagination.total_items) || !data.items.every(isQueueItem)) throw new Error('Invalid withdrawal queue');
    return { status: 200, data, message: '' };
  } catch {
    return { status: 503, data: null, message: 'Could not load withdrawal queue. Try again.' };
  }
}

export async function readPlatformWithdrawalHistory(page: number): Promise<WithdrawalHistoryRead> {
  const token = (await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  if (!token) return { status: 401, data: null, message: 'Session expired. Sign in again.' };
  if (!callerMatchesScope(token, true)) return { status: 403, data: null, message: 'Platform access required.' };
  const current = Number.isSafeInteger(page) && page > 0 ? page : 1;
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/platform/withdrawals?status=decided&page=${current}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    if (!response.ok) return { status: response.status, data: null, message: response.status === 401 ? 'Session expired. Sign in again.' : response.status === 403 ? 'Access denied.' : 'Could not load decision history. Try again.' };
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('status' in body) || body.status !== 'success' || !('data' in body)) throw new Error('Invalid history response');
    const data = body.data as History | null;
    if (!data || !Array.isArray(data.items) || !data.pagination || !Number.isSafeInteger(data.pagination.total_pages) || !Number.isSafeInteger(data.pagination.total_items) || !data.items.every(isHistoryItem)) throw new Error('Invalid withdrawal history');
    return { status: 200, data, message: '' };
  } catch {
    return { status: 503, data: null, message: 'Could not load decision history. Try again.' };
  }
}
