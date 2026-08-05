'use server';

import { apiRequest, getAuthCookieName } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { decodeTokenClaims } from '@/lib/auth/token';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { studentSchema } from '../_schemas/schema';

export interface StudentActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

const initialResponse = { success: false, message: '' } satisfies StudentActionResponse;

function getParentId(token: string): string | undefined {
  const claims = decodeTokenClaims(token);
  return claims.user_id || claims.sub;
}

function getStudentInput(formData: FormData) {
  const noteContent = String(formData.get('note_content') || '').trim();
  const noteType = String(formData.get('note_type') || '');
  return {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    nickname: formData.get('nickname'),
    gender: formData.get('gender') || undefined,
    date_of_birth: formData.get('date_of_birth'),
    student_note: noteContent ? { content: noteContent, note_type: noteType } : undefined,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 409) return 'Student tidak dapat dihapus karena masih memiliki enrollment aktif.';
  return error instanceof ApiError ? error.message : fallback;
}

export async function saveStudent(previous: StudentActionResponse = initialResponse, formData: FormData): Promise<StudentActionResponse> {
  void previous;
  const validation = studentSchema.safeParse(getStudentInput(formData));
  if (!validation.success) return { success: false, message: 'Periksa data student.', errors: validation.error.flatten().fieldErrors };

  const id = String(formData.get('id') || '').trim();
  const token = (await cookies()).get(getAuthCookieName())?.value;
  const parentId = token ? getParentId(token) : undefined;
  if (!id && !parentId) return { success: false, message: 'Session parent tidak tersedia. Silakan login kembali.' };

  const payload = id ? validation.data : { ...validation.data, parent_id: parentId };
  try {
    await apiRequest(id ? `/api/v1/students/${id}` : '/api/v1/students', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
      includeTenant: false,
    });
    revalidatePath('/dashboard/parent/students');
    if (id) revalidatePath(`/dashboard/parent/students/${id}`);
    return { success: true, message: id ? 'Data anak berhasil diperbarui.' : 'Anak berhasil ditambahkan.' };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, 'Data student gagal disimpan.') };
  }
}

export async function deleteStudent(previous: StudentActionResponse = initialResponse, formData: FormData): Promise<StudentActionResponse> {
  void previous;
  const id = String(formData.get('id') || '').trim();
  if (!id) return { success: false, message: 'Student tidak valid.' };
  try {
    await apiRequest(`/api/v1/students/${id}`, { method: 'DELETE', includeTenant: false });
    revalidatePath('/dashboard/parent/students');
    revalidatePath(`/dashboard/parent/students/${id}`);
    return { success: true, message: 'Data anak berhasil dihapus.' };
  } catch (error) {
    return { success: false, message: getErrorMessage(error, 'Student gagal dihapus.') };
  }
}