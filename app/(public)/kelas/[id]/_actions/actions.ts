'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage, withGatewayClientIp } from '@/lib/gateway';
import { getSessionIdentityFromToken } from '@/lib/auth-session';
import { duplicateEnrollmentState, enrollmentFormSchema, enrollmentPayload, isDuplicateEnrollmentResponse, isPlatformFeeRejectedResponse, platformFeeRejectedState, type EnrollmentActionState } from '@/lib/enrollment';
import {
  scheduleRequestCancelErrorMessage,
  scheduleRequestErrorMessage,
  scheduleRequestFormSchema,
  scheduleRequestListAnchor,
  scheduleRequestPayload,
} from '@/lib/schedule-request';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  if (!UUID_PATTERN.test(classId)) {
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
    if (isPlatformFeeRejectedResponse(response.status, result)) return platformFeeRejectedState;
    if (!response.ok || result.status !== 'success') return { success: false, message: responseMessage(response, result) };

    destination = checkoutUrl(result.data?.payment?.checkout_session_url);
    if (!destination) return { success: false, message: 'Enrollment tersimpan tetapi URL checkout belum tersedia. Silakan buka riwayat enrollment Anda.' };
  } catch (error) {
    return { success: false, message: getGatewayConfigurationErrorMessage(error) || 'Layanan enrollment sedang tidak tersedia. Coba lagi nanti.' };
  }

  if (!destination) return { success: false, message: 'URL checkout belum tersedia. Coba lagi dari detail kelas.' };
  redirect(destination);
}

type ScheduleSlotFormValue = { day_of_week: unknown; start_time: unknown; end_time: unknown };

function scheduleSlotFormValues(value: FormDataEntryValue | null): ScheduleSlotFormValue[] {
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as ScheduleSlotFormValue[]) : [];
  } catch {
    return [];
  }
}

function scheduleRequestValidationError(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): EnrollmentActionState {
  return { success: false, message: 'Periksa kembali permintaan jadwal Anda.', errors: error.flatten().fieldErrors };
}

/**
 * Files a private-class schedule request (KEL-109).
 *
 * The parent proposes weekly slots from the class detail page instead of going
 * through checkout. On success the action revalidates the detail page so the
 * request list below the form shows the new `pending` row; unlike
 * `enrollInClass` it never redirects. A 409 always means an earlier request is
 * still pending, so the message links to the request list.
 */
export async function createScheduleRequest(_previous: EnrollmentActionState, formData: FormData): Promise<EnrollmentActionState> {
  const classId = formData.get('class_id')?.toString().trim() || '';
  const validation = scheduleRequestFormSchema.safeParse({
    student_id: formData.get('student_id')?.toString() || '',
    billing_cycle: formData.get('billing_cycle')?.toString() || '',
    slots: scheduleSlotFormValues(formData.get('slots')),
    note: formData.get('note')?.toString() || undefined,
  });
  if (!validation.success) return scheduleRequestValidationError(validation.error);

  if (!UUID_PATTERN.test(classId)) {
    return { success: false, message: 'Kelas tidak valid. Muat ulang halaman lalu coba lagi.' };
  }

  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    const session = getSessionIdentityFromToken(token);
    if (!session?.isParent) return { success: false, message: 'Hanya parent yang login dapat mengajukan permintaan jadwal.' };

    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/catalog/classes/${encodeURIComponent(classId)}/schedule-requests`, {
      method: 'POST',
      headers: await withGatewayClientIp({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }),
      body: JSON.stringify(scheduleRequestPayload(validation.data)),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 409) {
      return {
        success: false,
        message: scheduleRequestErrorMessage(409),
        link: { href: scheduleRequestListAnchor(classId), label: 'Lihat daftar permintaan' },
      };
    }
    if (!response.ok || result.status !== 'success') {
      return { success: false, message: scheduleRequestErrorMessage(response.status, result.message) };
    }

    revalidatePath(`/kelas/${classId}`);
    return {
      success: true,
      message: 'Permintaan jadwal terkirim. Permintaan Anda menunggu peninjauan penyelenggara.',
      link: { href: scheduleRequestListAnchor(classId), label: 'Lihat daftar permintaan' },
    };
  } catch (error) {
    return { success: false, message: getGatewayConfigurationErrorMessage(error) || 'Layanan permintaan jadwal sedang tidak tersedia. Coba lagi nanti.' };
  }
}

/**
 * Cancels one of the signed-in parent's own pending schedule requests
 * (KEL-109). The backend owns the decision through the caller's parent id; the
 * browser supplies only the request id.
 */
export async function cancelScheduleRequest(_previous: EnrollmentActionState, formData: FormData): Promise<EnrollmentActionState> {
  const requestId = formData.get('request_id')?.toString().trim() || '';
  if (!UUID_PATTERN.test(requestId)) {
    return { success: false, message: 'ID permintaan jadwal tidak valid.' };
  }

  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    const session = getSessionIdentityFromToken(token);
    if (!session?.isParent) return { success: false, message: 'Hanya parent yang login dapat membatalkan permintaan jadwal.' };

    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/schedule-requests/${encodeURIComponent(requestId)}/cancel`, {
      method: 'POST',
      headers: await withGatewayClientIp({
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      }),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.status !== 'success') {
      return { success: false, message: scheduleRequestCancelErrorMessage(response.status, result.message) };
    }

    const classId = typeof result.data?.class_id === 'string' && UUID_PATTERN.test(result.data.class_id) ? result.data.class_id : null;
    if (classId) revalidatePath(`/kelas/${classId}`);
    else revalidatePath('/kelas');
    return { success: true, message: 'Permintaan jadwal berhasil dibatalkan.' };
  } catch (error) {
    return { success: false, message: getGatewayConfigurationErrorMessage(error) || 'Layanan permintaan jadwal sedang tidak tersedia. Coba lagi nanti.' };
  }
}
