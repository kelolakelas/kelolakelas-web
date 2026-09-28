import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeListEnvelope } from '@/lib/list-envelope';
import { normalizeScheduleRequests, type ScheduleRequest } from '@/lib/schedule-request';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

export type ScheduleRequestListResult =
  | { data: { requests: ScheduleRequest[] }; error: null }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string };

/**
 * Parent-scoped schedule-request list (KEL-109), following the
 * `getEnrollmentHistory` pattern: the backend scopes rows to the caller, so
 * another parent's request answers as if it never existed.
 */
export async function getScheduleRequests(): Promise<ScheduleRequestListResult> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value || '';
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/schedule-requests?page=1&page_size=100`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      return { data: null, error: 'forbidden', message: 'Anda tidak memiliki akses ke daftar permintaan jadwal ini.' };
    }
    if (!response.ok || result.status !== 'success') {
      return { data: null, error: 'api', message: 'Daftar permintaan jadwal belum dapat dimuat.' };
    }
    return { data: { requests: normalizeScheduleRequests(normalizeListEnvelope(result.data).items) }, error: null };
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message: getGatewayConfigurationErrorMessage(error) || 'Layanan permintaan jadwal sedang tidak tersedia. Coba lagi nanti.',
    };
  }
}
