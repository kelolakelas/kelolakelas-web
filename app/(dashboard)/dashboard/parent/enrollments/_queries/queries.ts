import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeListEnvelope } from '@/lib/list-envelope';
import type { EnrollmentRecord, TransactionRecord } from '@/lib/payment-status';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
export type EnrollmentHistoryResult =
  | { data: { enrollments: EnrollmentRecord[]; transactions: TransactionRecord[] }; error: null }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string };

async function readList<T>(path: string, token: string): Promise<{ response: Response; data: { items?: T[]; status?: string; message?: string } }> {
  const response = await fetch(`${getGatewayBaseUrl()}${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, cache: 'no-store' });
  return { response, data: await response.json().catch(() => ({})) };
}

export async function getEnrollmentHistory(): Promise<EnrollmentHistoryResult> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value || '';
    const [enrollment, transaction] = await Promise.all([readList<EnrollmentRecord>('/api/v1/enrollments?page=1&page_size=100', token), readList<TransactionRecord>('/api/v1/billing/transactions?page=1&page_size=100', token)]);
    if (enrollment.response.status === 401 || enrollment.response.status === 403 || transaction.response.status === 401 || transaction.response.status === 403) return { data: null, error: 'forbidden', message: 'Anda tidak memiliki akses ke riwayat enrollment atau pembayaran ini.' };
    if (!enrollment.response.ok || enrollment.data.status !== 'success' || !transaction.response.ok || transaction.data.status !== 'success') return { data: null, error: 'api', message: 'Riwayat enrollment atau pembayaran belum dapat dimuat.' };
    return { data: { enrollments: enrollment.data.items || [], transactions: transaction.data.items || [] }, error: null };
  } catch (error) {
    return { data: null, error: 'configuration', message: getGatewayConfigurationErrorMessage(error) || 'Layanan riwayat enrollment sedang tidak tersedia. Coba lagi nanti.' };
  }
}

export type PaymentReturnError = 'not_found' | 'forbidden' | 'api' | 'configuration';

export type PaymentReturnResult =
  | { data: { enrollment: EnrollmentRecord; transaction: TransactionRecord }; error: null }
  | { data: null; error: PaymentReturnError; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOT_FOUND_MESSAGE = 'Pembayaran ini tidak ditemukan pada akun Anda. Buka riwayat enrollment untuk melihat semua pembayaran.';
const FORBIDDEN_MESSAGE = 'Anda tidak memiliki akses ke status pembayaran ini. Masuk kembali dengan akun parent yang melakukan pembayaran.';
const API_MESSAGE = 'Status pembayaran belum dapat dimuat dari server.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readGatewayBody(path: string, token: string): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await fetch(`${getGatewayBaseUrl()}${path}`, { headers: { Accept: 'application/json', Authorization: 'Bearer ' + token }, cache: 'no-store' });
  const body: unknown = await response.json().catch(() => ({}));
  return { response, body: isRecord(body) ? body : {} };
}

/**
 * Loads the transaction a payment-provider return points at, together with its
 * enrollment (KEL-44).
 *
 * The lookup goes through the parent-scoped billing list: billing applies the
 * parent id from the verified session, so another parent's order id matches no
 * row and is reported exactly like an id that never existed. Billing's `search`
 * filter is a substring match on the merchant order id or the payment intent id,
 * so only an exact `merchant_order_id` match is accepted. Academic scopes the
 * enrollment read to the parent in the same way.
 *
 * Both services answer `{status, data}`, and a list's `data` is
 * `{items, pagination}` passed through the gateway unchanged (ADR 0018).
 *
 * The caller must pass an id that already passed `parseMerchantOrderId`, which
 * keeps `%` and `_` out of billing's `ILIKE` pattern.
 */
export async function getPaymentReturnStatus(merchantOrderId: string): Promise<PaymentReturnResult> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value || '';
    const transactions = await readGatewayBody(`/api/v1/billing/transactions?search=${encodeURIComponent(merchantOrderId)}&page=1&page_size=20`, token);
    if (transactions.response.status === 401 || transactions.response.status === 403) return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    if (!transactions.response.ok || transactions.body.status !== 'success') return { data: null, error: 'api', message: API_MESSAGE };
    const match = normalizeListEnvelope<unknown>(transactions.body.data).items.find((item) => isRecord(item) && item.merchant_order_id === merchantOrderId);
    if (!isRecord(match)) return { data: null, error: 'not_found', message: NOT_FOUND_MESSAGE };
    if (typeof match.enrollment_id !== 'string' || !UUID_PATTERN.test(match.enrollment_id) || typeof match.status !== 'string') return { data: null, error: 'api', message: API_MESSAGE };
    const transaction = match as TransactionRecord;

    const enrollment = await readGatewayBody(`/api/v1/enrollments/${transaction.enrollment_id}`, token);
    if (enrollment.response.status === 401 || enrollment.response.status === 403) return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    if (enrollment.response.status === 404) return { data: null, error: 'not_found', message: NOT_FOUND_MESSAGE };
    const record = enrollment.body.data;
    if (!enrollment.response.ok || enrollment.body.status !== 'success' || !isRecord(record) || typeof record.id !== 'string' || typeof record.status !== 'string') return { data: null, error: 'api', message: API_MESSAGE };
    return { data: { enrollment: record as EnrollmentRecord, transaction }, error: null };
  } catch (error) {
    return { data: null, error: 'configuration', message: getGatewayConfigurationErrorMessage(error) || 'Layanan status pembayaran sedang tidak tersedia. Coba lagi nanti.' };
  }
}
