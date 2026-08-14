'use server';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { revalidatePath } from 'next/cache';
import { studentSchema } from '../_schemas/schema';

export interface StudentActionResponse { success: boolean; message: string; errors?: Record<string, string[]>; }

function getStudentInput(formData: FormData) {
  const noteContents = formData.getAll('note_content').map((value) => String(value).trim());
  const noteTypes = formData.getAll('note_type').map((value) => String(value));
  const studentNotes = noteContents
    .map((content, index) => ({ content, note_type: noteTypes[index] }))
    .filter((note) => note.content || note.note_type);
  return {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    nickname: formData.get('nickname'),
    gender: formData.get('gender') || undefined,
    date_of_birth: formData.get('date_of_birth'),
    student_notes: studentNotes.length ? studentNotes : undefined,
  };
}

export async function saveStudent(_previous: StudentActionResponse = { success: false, message: '' }, formData: FormData): Promise<StudentActionResponse> {
  void _previous;
  const validation = studentSchema.safeParse(getStudentInput(formData));
  if (!validation.success) return { success: false, message: 'Periksa data student.', errors: validation.error.flatten().fieldErrors };
  const id = String(formData.get('id') || '');
  const parentId = String(formData.get('parent_id') || '').trim();
  if (!id && !parentId) return { success: false, message: 'Parent ID wajib diisi saat membuat student.' };
  try {
    await apiRequest(id ? `/api/v1/students/${id}` : '/api/v1/students', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(id ? validation.data : { ...validation.data, parent_id: parentId }),
      includeTenant: true,
      requiresAuth: true,
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
    await apiRequest(`/api/v1/students/${id}`, { method: 'DELETE', requiresAuth: true });
    revalidatePath('/dashboard/tenant/students');
    revalidatePath('/dashboard/parent/students');
    return { success: true, message: 'Student berhasil dihapus.' };
  } catch (error) {
    return { success: false, message: error instanceof ApiError ? error.message : 'Student gagal dihapus.' };
  }
}