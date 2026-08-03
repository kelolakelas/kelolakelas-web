'use server';

import { apiRequest, getTenantCookieName } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { enrollmentSchema, enrollmentStatusSchema } from '../_lib/schema';

export interface ActionResponse { success: boolean; message: string; data?: unknown; errors?: Record<string, string[]>; }

export async function createEnrollment(_previous: ActionResponse, formData: FormData): Promise<ActionResponse> {
  const validation = enrollmentSchema.safeParse({
    class_id: formData.get('class_id'),
    student_id: formData.get('student_id'),
    billing_cycle: formData.get('billing_cycle'),
    platform_fee: formData.get('platform_fee'),
  });
  if (!validation.success) return { success: false, message: 'Data enrollment belum valid.', errors: validation.error.flatten().fieldErrors };

  const tenantId = (await cookies()).get(getTenantCookieName())?.value;
  if (!tenantId) return { success: false, message: 'Tenant context tidak tersedia. Silakan login kembali.' };
  try {
    const result = await apiRequest(`/api/v1/tenants/${tenantId}/enrollments`, { method: 'POST', body: JSON.stringify(validation.data) });
    revalidatePath('/dashboard/tenant/enrollments');
    return { success: true, message: 'Enrollment berhasil dibuat dengan status pending.', data: result.data };
  } catch (error) {
    return { success: false, message: error instanceof ApiError ? error.message : 'Enrollment gagal dibuat.' };
  }
}

export async function updateEnrollmentStatus(_previous: ActionResponse, formData: FormData): Promise<ActionResponse> {
  const validation = enrollmentStatusSchema.safeParse(formData.get('status'));
  const enrollmentId = String(formData.get('enrollment_id') || '');
  if (!validation.success || !enrollmentId) return { success: false, message: 'Status enrollment tidak valid.' };
  try {
    await apiRequest(`/api/v1/enrollments/${enrollmentId}/status`, { method: 'PUT', body: JSON.stringify({ status: validation.data }) });
    revalidatePath('/dashboard/tenant/enrollments');
    return { success: true, message: 'Status enrollment berhasil diperbarui.' };
  } catch (error) {
    return { success: false, message: error instanceof ApiError ? error.message : 'Status enrollment gagal diperbarui.' };
  }
}
