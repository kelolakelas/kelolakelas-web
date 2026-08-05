'use server';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { PublicEnrollmentResponse } from '@/lib/api/types';
import { enrollmentSchema } from '../_schemas/schema';

export interface EnrollmentActionResponse {
  success: boolean;
  message: string;
  payment?: PublicEnrollmentResponse['payment'];
  enrollmentId?: string;
  status?: number;
}

export async function enrollInCatalogClass(_previous: EnrollmentActionResponse, formData: FormData): Promise<EnrollmentActionResponse> {
  const validation = enrollmentSchema.safeParse({ class_id: formData.get('class_id'), student_id: formData.get('student_id'), billing_cycle: formData.get('billing_cycle') });
  if (!validation.success) return { success: false, message: validation.error.issues[0]?.message || 'Periksa data enrollment.' };
  try {
    const response = await apiRequest<PublicEnrollmentResponse>(`/api/v1/catalog/classes/${encodeURIComponent(validation.data.class_id)}/enrollments`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ student_id: validation.data.student_id, billing_cycle: validation.data.billing_cycle }), includeTenant: false });
    return { success: true, message: response.message || 'Enrollment berhasil dibuat.', payment: response.data?.payment, enrollmentId: response.data?.enrollment.id };
  } catch (error) {
    if (error instanceof ApiError) {
      const messages: Record<number, string> = { 401: 'Login diperlukan untuk enroll.', 403: 'Akun ini bukan parent atau tidak memiliki izin.', 404: 'Class atau student tidak ditemukan.', 409: 'Enrollment duplikat, idempotency conflict, atau class sudah penuh.', 422: 'Class tidak dapat di-enroll oleh student ini.', 500: 'Layanan sedang bermasalah. Coba lagi nanti.' };
      return { success: false, message: messages[error.status || 0] || error.message, status: error.status };
    }
    return { success: false, message: 'Enrollment gagal diproses.' };
  }
}