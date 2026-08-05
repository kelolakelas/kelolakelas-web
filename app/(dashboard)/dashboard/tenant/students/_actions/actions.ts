'use server';

import { apiRequest, getAuthCookieName } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { decodeTokenClaims } from '@/lib/auth/token';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { studentSchema } from '../_schemas/schema';

export interface StudentActionResponse { success: boolean; message: string; errors?: Record<string, string[]>; }

function getParentId(token: string): string | undefined {
  const claims = decodeTokenClaims(token) as { sub?: string; user_id?: string; is_parent?: boolean };
  return claims.user_id || claims.sub;
}

export async function saveStudent(_previous: StudentActionResponse, formData: FormData): Promise<StudentActionResponse> {
  const validation = studentSchema.safeParse({ first_name: formData.get('first_name'), last_name: formData.get('last_name'), date_of_birth: formData.get('date_of_birth') });
  if (!validation.success) return { success: false, message: 'Periksa data student.', errors: validation.error.flatten().fieldErrors };
  const id = String(formData.get('id') || '');
  const token = (await cookies()).get(getAuthCookieName())?.value;
  const parentId = token ? getParentId(token) : undefined;
  if (!id && !parentId) return { success: false, message: 'Parent context tidak tersedia pada session. Silakan login kembali.' };
  try {
    await apiRequest(id ? `/api/v1/students/${id}` : '/api/v1/students', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(id ? validation.data : { ...validation.data, parent_id: parentId }),
    });
    revalidatePath('/dashboard/tenant/students');
    revalidatePath('/dashboard/parent/students');
    return { success: true, message: id ? 'Student berhasil diperbarui.' : 'Student berhasil dibuat.' };
  } catch (error) {
    return { success: false, message: error instanceof ApiError ? error.message : 'Student gagal disimpan.' };
  }
}

export async function deleteStudent(_previous: StudentActionResponse, formData: FormData): Promise<StudentActionResponse> {
  const id = String(formData.get('id') || '');
  if (!id) return { success: false, message: 'Student tidak valid.' };
  try {
    await apiRequest(`/api/v1/students/${id}`, { method: 'DELETE' });
    revalidatePath('/dashboard/tenant/students');
    revalidatePath('/dashboard/parent/students');
    return { success: true, message: 'Student berhasil dihapus.' };
  } catch (error) {
    return { success: false, message: error instanceof ApiError ? error.message : 'Student gagal dihapus.' };
  }
}