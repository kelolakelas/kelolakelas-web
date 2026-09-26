'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage, withGatewayClientIp } from '@/lib/gateway';
import { getSessionIdentityFromToken } from '@/lib/auth-session';
import { duplicateEnrollmentState, enrollmentFormSchema, enrollmentPayload, isDuplicateEnrollmentResponse, type EnrollmentActionState } from '@/lib/enrollment';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

function validationError(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): EnrollmentActionState {
  return { success: false, message: 'Periksa kembali pilihan enrollment Anda.', errors: error.flatten().fieldErrors };
}

function responseMessage(response: Response, result: { message?: string }) {
  if (response.status === 401 || response.status === 403) return 'Hanya parent yang login dapat memulai enrollment.';
  if (response.status === 404) return 'Kelas atau student tidak ditemukan. Muat ulang halaman lalu coba lagi.';
  if (response.status === 409) return 'Jadwal penuh atau enrollment ini sudah berubah. Pilih jadwal lain atau gunakan checkout yang sama.';
  if (response.status === 422) {
    const message = (result.message || '').toLowerCase();
    if (message.includes('student') && (message.includes('belong') || message.includes('ownership'))) return 'Student yang dipilih bukan milik akun parent ini.';
    if (message.includes('enroll') || message.includes('published') || message.includes('open')) return 'Kelas ini sudah tidak menerima enrollment.';
    return 'Pilihan enrollment tidak dapat diproses. Periksa student dan jadwal Anda.';
  }
  if (response.status >= 500) return 'Checkout belum tersedia karena layanan pembayaran sedang bermasalah. Coba lagi nanti.';
  return result.message || 'Enrollment gagal diproses.';
}

function checkoutUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function enrollInClass(classId: string, _previous: EnrollmentActionState, formData: FormData): Promise<EnrollmentActionState> {
  const validation = enrollmentFormSchema.safeParse({
    student_id: formData.get('student_id')?.toString() || '',
    billing_cycle: formData.get('billing_cycle')?.toString() || '',
    schedule_id: formData.get('schedule_id')?.toString() || '',
    idempotency_key: formData.get('idempotency_key')?.toString() || '',
  });
  if (!validation.success) return validationError(validation.error);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId)) {
    return { success: false, message: 'Kelas tidak valid. Muat ulang halaman lalu coba lagi.' };
  }

  let destination: string | null = null;
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    const session = getSessionIdentityFromToken(token);
    if (!session?.isParent) return { success: false, message: 'Hanya parent yang login dapat memulai enrollment.' };

    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/catalog/classes/${encodeURIComponent(classId)}/enrollments`, {
      method: 'POST',
      headers: await withGatewayClientIp({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': validation.data.idempotency_key,
      }),
      body: JSON.stringify(enrollmentPayload(validation.data)),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    if (isDuplicateEnrollmentResponse(response.status, result)) return duplicateEnrollmentState;
    if (!response.ok || result.status !== 'success') return { success: false, message: responseMessage(response, result) };

    destination = checkoutUrl(result.data?.payment?.checkout_session_url);
    if (!destination) return { success: false, message: 'Enrollment tersimpan tetapi URL checkout belum tersedia. Silakan buka riwayat enrollment Anda.' };
  } catch (error) {
    return { success: false, message: getGatewayConfigurationErrorMessage(error) || 'Layanan enrollment sedang tidak tersedia. Coba lagi nanti.' };
  }

  if (!destination) return { success: false, message: 'URL checkout belum tersedia. Coba lagi dari detail kelas.' };
  redirect(destination);
}
