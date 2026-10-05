'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import {
  reportCreatePayload,
  reportFormSchema,
  reportIdSchema,
  reportUpdateFormSchema,
  reportUpdatePayload,
  TENANT_REPORTS_PATH,
} from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

export interface ReportActionState {
  success: boolean;
  message: string;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value || '';
  const tenantId = cookieStore.get(TENANT_COOKIE)?.value || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  return headers;
}

/**
 * Member-safe message for a report write refusal.
 *
 * A tutor who does not teach the enrollment meets `403 "Tutor is not
 * assigned to this enrollment"`; it is told plainly instead of as a
 * technical failure. The raw server text never reaches the screen.
 */
function backendMessage(status: number, action: 'create' | 'update' | 'delete'): string {
  if (status === 400)
    return action === 'create'
      ? 'Data laporan tidak valid. Periksa judul dan skor Anda.'
      : 'Data laporan tidak valid. Periksa kembali input Anda.';
  if (status === 401 || status === 403)
    return action === 'create'
      ? 'Anda tidak memiliki izin membuat laporan untuk siswa ini, atau siswa ini bukan siswa yang Anda ajar.'
      : 'Anda tidak memiliki izin mengubah laporan ini. Hanya pengajar kelas siswa tersebut yang dapat mengubahnya.';
  if (status === 404) return 'Laporan tidak ditemukan. Muat ulang halaman lalu coba lagi.';
  if (status === 409) return 'Laporan tidak dapat disimpan karena bertentangan dengan keadaan terbaru.';
  return 'Laporan belum dapat disimpan. Coba lagi nanti.';
}

async function sendReportRequest(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body: Record<string, unknown> | null,
  action: 'create' | 'update' | 'delete',
  successMessage: string
): Promise<ReportActionState> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${getGatewayBaseUrl()}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });

    if (!response.ok) return { success: false, message: backendMessage(response.status, action) };
    revalidatePath(TENANT_REPORTS_PATH);
    return { success: true, message: successMessage };
  } catch (error) {
    return {
      success: false,
      message: getGatewayConfigurationErrorMessage(error) || 'Laporan belum dapat disimpan. Coba lagi nanti.',
    };
  }
}

/**
 * Creates one student evaluation report (KEL-139).
 *
 * The body mirrors `domain.CreateReportRequest` exactly (`enrollment_id`,
 * `title`, `evaluation_notes`, `score`); the enrollment identifier comes
 * from the create-form select, never from a free-text field.
 */
export async function createTenantReport(
  _previous: ReportActionState,
  formData: FormData
): Promise<ReportActionState> {
  const input = {
    enrollment_id: String(formData.get('enrollment_id') ?? '').trim(),
    title: String(formData.get('title') ?? ''),
    evaluation_notes: String(formData.get('evaluation_notes') ?? ''),
    score: String(formData.get('score') ?? '').trim(),
  };
  const parsed = reportFormSchema.safeParse(input);

  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0]?.message || 'Data laporan tidak valid.' };
  return sendReportRequest('/api/v1/reports', 'POST', reportCreatePayload(parsed.data), 'create', 'Laporan berhasil dibuat.');
}

/**
 * Updates one student evaluation report (KEL-139).
 *
 * The body mirrors `domain.UpdateReportRequest` (`title`,
 * `evaluation_notes`, `score`); no enrollment is sent because the backend
 * checks the assignment against the stored enrollment.
 */
export async function updateTenantReport(
  _previous: ReportActionState,
  formData: FormData
): Promise<ReportActionState> {
  const input = {
    report_id: String(formData.get('report_id') ?? '').trim(),
    title: String(formData.get('title') ?? ''),
    evaluation_notes: String(formData.get('evaluation_notes') ?? ''),
    score: String(formData.get('score') ?? '').trim(),
  };
  const parsed = reportUpdateFormSchema.safeParse(input);

  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0]?.message || 'Data laporan tidak valid.' };
  return sendReportRequest(
    `/api/v1/reports/${encodeURIComponent(parsed.data.report_id)}`,
    'PATCH',
    reportUpdatePayload(parsed.data),
    'update',
    'Laporan berhasil diperbarui.'
  );
}

/**
 * Deletes one student evaluation report (KEL-139).
 *
 * Only the identifier travels; there is no body for the backend to bind.
 * A tutor who does not teach the report's class meets the same 403 as the
 * update path.
 */
export async function deleteTenantReport(
  _previous: ReportActionState,
  formData: FormData
): Promise<ReportActionState> {
  const parsed = reportIdSchema.safeParse(String(formData.get('report_id') ?? '').trim());

  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0]?.message || 'ID laporan tidak valid.' };
  return sendReportRequest(
    `/api/v1/reports/${encodeURIComponent(parsed.data)}`,
    'DELETE',
    null,
    'delete',
    'Laporan berhasil dihapus.'
  );
}
