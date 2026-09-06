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
  studentId?: string;
  billingCycle?: 'monthly' | 'quarterly' | 'yearly';
  scheduleId?: string;
  status?: number;
}

export async function enrollInCatalogClass(_previous: EnrollmentActionResponse, formData: FormData): Promise<EnrollmentActionResponse> {
  const rawStudentId = String(formData.get('student_id') || '').trim();
  const rawBillingCycle = formData.get('billing_cycle');
  const rawScheduleId = String(formData.get('schedule_id') || '').trim();
  const validation = enrollmentSchema.safeParse({ class_id: formData.get('class_id'), student_id: rawStudentId, billing_cycle: rawBillingCycle, class_type: formData.get('class_type') || undefined, schedule_id: rawScheduleId || undefined });
  if (!validation.success) return { success: false, message: validation.error.issues[0]?.message || 'Periksa data enrollment.', studentId: rawStudentId || undefined, billingCycle: rawBillingCycle === 'monthly' || rawBillingCycle === 'quarterly' || rawBillingCycle === 'yearly' ? rawBillingCycle : undefined, scheduleId: rawScheduleId || undefined };
  const idempotencyKey = String(formData.get('idempotency_key') || '').trim();
  if (!idempotencyKey) return { success: false, message: 'Permintaan enrollment tidak valid. Silakan coba lagi.' };
  try {
    const requestBody = { student_id: validation.data.student_id, billing_cycle: validation.data.billing_cycle, ...(validation.data.schedule_id ? { schedule_id: validation.data.schedule_id } : {}) };
    const response = await apiRequest<PublicEnrollmentResponse>(`/api/v1/catalog/classes/${encodeURIComponent(validation.data.class_id)}/enrollments`, { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(requestBody), includeTenant: false, requiresAuth: true });
    return { success: true, message: response.message || 'Invoice berhasil dibuat. Enrollment masih pending sampai pembayaran terkonfirmasi.', payment: response.data?.payment, enrollmentId: response.data?.enrollment.id, studentId: validation.data.student_id, billingCycle: validation.data.billing_cycle, scheduleId: validation.data.schedule_id };
  } catch (error) {
    if (error instanceof ApiError) {
      const messages: Record<number, string> = { 400: 'Data enrollment tidak valid.', 401: 'Login diperlukan untuk enroll.', 403: 'Akun ini bukan parent atau tidak memiliki izin.', 404: 'Class atau student tidak ditemukan.', 409: 'Schedule yang dipilih baru saja penuh atau enrollment sudah dibuat. Pilih schedule lain dan coba lagi.', 422: 'Class, schedule, atau student tidak dapat digunakan untuk enrollment.', 500: 'Layanan pembayaran atau akademik sedang bermasalah. Coba lagi nanti.' };
      return { success: false, message: messages[error.status || 0] || error.message, status: error.status };
    }
    return { success: false, message: 'Enrollment gagal diproses.' };
  }
}