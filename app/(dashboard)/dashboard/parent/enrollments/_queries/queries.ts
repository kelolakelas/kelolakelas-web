import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
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
