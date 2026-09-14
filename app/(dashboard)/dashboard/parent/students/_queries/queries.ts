import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeStudentList, type StudentListData } from '@/lib/students';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

export type StudentQueryResult =
  | { data: StudentListData; error: null }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string };

export async function getStudents(): Promise<StudentQueryResult> {
  try {
    const baseUrl = getGatewayBaseUrl();
    const token = (await cookies()).get(AUTH_COOKIE)?.value || '';
    const response = await fetch(`${baseUrl}/api/v1/students?page=1&page_size=100`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      return { data: null, error: 'forbidden', message: 'Anda tidak memiliki akses ke profil student ini.' };
    }
    if (!response.ok || result.status !== 'success') {
      return { data: null, error: 'api', message: result.message || 'Daftar student belum dapat dimuat.' };
    }

    return { data: normalizeStudentList(result.data), error: null };
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message: getGatewayConfigurationErrorMessage(error) || 'Layanan student sedang tidak tersedia. Coba lagi nanti.',
    };
  }
}
