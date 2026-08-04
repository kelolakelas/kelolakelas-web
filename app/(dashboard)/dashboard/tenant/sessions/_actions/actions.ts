'use server';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { revalidatePath } from 'next/cache';
import {
    rescheduleSessionSchema,
    substituteTutorSchema,
    type SessionActionResponse,
} from '../_lib/schema';

export async function rescheduleSession(
  _previous: SessionActionResponse,
  formData: FormData
): Promise<SessionActionResponse> {
  const validation = rescheduleSessionSchema.safeParse({
    sessionId: formData.get('sessionId'),
    newSessionDate: formData.get('newSessionDate'),
    newStartTime: formData.get('newStartTime'),
    newEndTime: formData.get('newEndTime'),
    newLocation: formData.get('newLocation') || undefined,
  });
  if (!validation.success) {
    return { success: false, message: 'Periksa data perubahan jadwal.', errors: validation.error.flatten().fieldErrors };
  }

  try {
    await apiRequest(`/api/v1/sessions/${validation.data.sessionId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: validation.data.sessionId,
        new_session_date: `${validation.data.newSessionDate}T00:00:00Z`,
        new_start_time: validation.data.newStartTime,
        new_end_time: validation.data.newEndTime,
        new_location: validation.data.newLocation,
      }),
    });
    revalidatePath(`/dashboard/tenant/sessions/${validation.data.sessionId}`);
    revalidatePath('/dashboard/tenant/classes');
    return { success: true, message: 'Session berhasil dijadwalkan ulang.' };
  } catch (error) {
    if (error instanceof ApiError) return { success: false, message: error.message };
    console.error('[rescheduleSession Error]:', error);
    return { success: false, message: 'Session gagal dijadwalkan ulang.' };
  }
}

export async function substituteTutor(
  _previous: SessionActionResponse,
  formData: FormData
): Promise<SessionActionResponse> {
  const validation = substituteTutorSchema.safeParse({
    sessionId: formData.get('sessionId'),
    substituteTutorId: formData.get('substituteTutorId'),
  });
  if (!validation.success) {
    return { success: false, message: 'Masukkan ID tutor pengganti yang valid.', errors: validation.error.flatten().fieldErrors };
  }

  try {
    await apiRequest(`/api/v1/sessions/${validation.data.sessionId}/substitute-tutor`, {
      method: 'PATCH',
      body: JSON.stringify({
        session_id: validation.data.sessionId,
        substitute_tutor_id: validation.data.substituteTutorId,
      }),
    });
    revalidatePath(`/dashboard/tenant/sessions/${validation.data.sessionId}`);
    return { success: true, message: 'Tutor pengganti berhasil ditetapkan.' };
  } catch (error) {
    if (error instanceof ApiError) return { success: false, message: error.message };
    console.error('[substituteTutor Error]:', error);
    return { success: false, message: 'Tutor pengganti gagal ditetapkan.' };
  }
}

export async function cancelSession(
  _previous: SessionActionResponse,
  formData: FormData
): Promise<SessionActionResponse> {
  const sessionId = formData.get('sessionId')?.toString().trim();
  if (!sessionId) return { success: false, message: 'Session tidak valid.' };

  try {
    await apiRequest(`/api/v1/sessions/${sessionId}`, { method: 'DELETE' });
    revalidatePath('/dashboard/tenant/sessions');
    revalidatePath(`/dashboard/tenant/sessions/${sessionId}`);
    revalidatePath('/dashboard/tenant/classes');
    return { success: true, message: 'Session berhasil dibatalkan.' };
  } catch (error) {
    if (error instanceof ApiError) return { success: false, message: error.message };
    console.error('[cancelSession Error]:', error);
    return { success: false, message: 'Session gagal dibatalkan.' };
  }
}