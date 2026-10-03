'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import {
  rescheduleSchema,
  rescheduleDatePayload,
  substituteTutorSchema,
  TENANT_SESSIONS_PATH,
} from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

export interface ScheduleActionState {
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

function backendMessage(status: number, substitute: boolean): string {
  if (status === 400) return substitute ? 'Tutor pengganti tidak valid. Pilih tutor lain.' : 'Tanggal atau waktu reschedule tidak valid. Periksa kembali input Anda.';
  if (status === 401 || status === 403) return 'Anda tidak memiliki izin mengubah sesi ini.';
  if (status === 404) return substitute ? 'Sesi atau tutor tidak ditemukan. Periksa kembali pilihan Anda.' : 'Sesi tidak ditemukan. Muat ulang halaman lalu coba lagi.';
  if (status === 409 || status === 410) return 'Sesi tidak dapat diubah karena bertentangan dengan keadaan terbaru.';
  return 'Perubahan sesi belum dapat disimpan. Coba lagi nanti.';
}

async function sendScheduleRequest(
  path: string,
  method: 'POST' | 'PATCH',
  body: Record<string, string>,
  substitute: boolean,
): Promise<ScheduleActionState> {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${getGatewayBaseUrl()}${path}`, { method, headers, body: JSON.stringify(body), cache: 'no-store' });

    if (!response.ok) return { success: false, message: backendMessage(response.status, substitute) };
    revalidatePath(TENANT_SESSIONS_PATH);
    return { success: true, message: substitute ? 'Tutor pengganti berhasil ditugaskan.' : 'Sesi berhasil di-reschedule.' };
  } catch (error) {
    return {
      success: false,
      message: getGatewayConfigurationErrorMessage(error) || 'Perubahan sesi belum dapat disimpan. Coba lagi nanti.',
    };
  }
}

export async function rescheduleSession(
  _previous: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const input = {
    session_id: String(formData.get('session_id') ?? '').trim(),
    new_session_date: String(formData.get('new_session_date') ?? '').trim(),
    new_start_time: String(formData.get('new_start_time') ?? '').trim(),
    new_end_time: String(formData.get('new_end_time') ?? '').trim(),
  };
  const parsed = rescheduleSchema.safeParse(input);

  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message || 'Input reschedule tidak valid.' };
  return sendScheduleRequest(
    `/api/v1/sessions/${encodeURIComponent(parsed.data.session_id)}/reschedule`,
    'POST',
    {
      ...parsed.data,
      new_session_date: rescheduleDatePayload(parsed.data.new_session_date),
    },
    false,
  );
}

export async function assignSubstituteTutor(
  _previous: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const input = {
    session_id: String(formData.get('session_id') ?? '').trim(),
    substitute_tutor_id: String(formData.get('substitute_tutor_id') ?? '').trim(),
  };
  const parsed = substituteTutorSchema.safeParse(input);

  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message || 'Tutor pengganti tidak valid.' };
  return sendScheduleRequest(
    `/api/v1/sessions/${encodeURIComponent(parsed.data.session_id)}/substitute-tutor`,
    'PATCH',
    parsed.data,
    true,
  );
}
