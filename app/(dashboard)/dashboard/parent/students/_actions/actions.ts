'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { getUserIdFromToken } from '@/lib/auth-session';
import { studentFormSchema, studentPayload, type StudentActionState } from '@/lib/students';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const STUDENTS_PATH = '/dashboard/parent/students';

function responseMessage(response: Response, result: { message?: string }) {
  if (response.status === 401) return 'Sesi Anda tidak valid. Silakan login kembali.';
  if (response.status === 403) return 'Anda tidak berwenang mengubah student ini.';
  if (response.status === 409) return 'Student tidak dapat dihapus karena masih memiliki enrollment aktif.';
  return result.message || 'Permintaan student gagal diproses.';
}

async function request(path: string, method: string, body?: unknown) {
  const token = (await cookies()).get(AUTH_COOKIE)?.value || '';
  const baseUrl = getGatewayBaseUrl();
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
}

function formInput(formData: FormData) {
  return {
    first_name: formData.get('first_name')?.toString() || '',
    last_name: formData.get('last_name')?.toString() || undefined,
    nickname: formData.get('nickname')?.toString() || undefined,
    gender: (formData.get('gender')?.toString() || undefined) as 'male' | 'female' | undefined,
    date_of_birth: formData.get('date_of_birth')?.toString() || '',
  };
}

function validationError(error: { flatten: () => { fieldErrors: Record<string, string[]> } }): StudentActionState {
  return { success: false, message: 'Periksa kembali field student yang ditandai.', errors: error.flatten().fieldErrors };
}

export async function createStudent(_previous: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const validation = studentFormSchema.safeParse(formInput(formData));
  if (!validation.success) return validationError(validation.error);

  try {
    const parentId = getUserIdFromToken((await cookies()).get(AUTH_COOKIE)?.value);
    if (!parentId) return { success: false, message: 'Sesi parent tidak valid. Silakan login kembali.' };
    const response = await request('/api/v1/students', 'POST', studentPayload(validation.data, parentId));
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== 'success') return { success: false, message: responseMessage(response, result) };
    revalidatePath(STUDENTS_PATH);
    return { success: true, message: 'Profil student berhasil dibuat.' };
  } catch (error) {
    return { success: false, message: getGatewayConfigurationErrorMessage(error) || 'Layanan student sedang tidak tersedia. Coba lagi nanti.' };
  }
}

export async function updateStudent(_previous: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const studentId = formData.get('student_id')?.toString() || '';
  const validation = studentFormSchema.safeParse(formInput(formData));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) {
    return { success: false, message: 'ID student tidak valid.' };
  }
  if (!validation.success) return validationError(validation.error);

  try {
    const response = await request(`/api/v1/students/${studentId}`, 'PATCH', studentPayload(validation.data));
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== 'success') return { success: false, message: responseMessage(response, result) };
    revalidatePath(STUDENTS_PATH);
    return { success: true, message: 'Profil student berhasil diperbarui.' };
  } catch (error) {
    return { success: false, message: getGatewayConfigurationErrorMessage(error) || 'Layanan student sedang tidak tersedia. Coba lagi nanti.' };
  }
}

export async function deleteStudent(_previous: StudentActionState, formData: FormData): Promise<StudentActionState> {
  const studentId = formData.get('student_id')?.toString() || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) {
    return { success: false, message: 'ID student tidak valid.' };
  }

  try {
    const response = await request(`/api/v1/students/${studentId}`, 'DELETE');
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== 'success') return { success: false, message: responseMessage(response, result) };
    revalidatePath(STUDENTS_PATH);
    return { success: true, message: 'Profil student berhasil dihapus.' };
  } catch (error) {
    return { success: false, message: getGatewayConfigurationErrorMessage(error) || 'Layanan student sedang tidak tersedia. Coba lagi nanti.' };
  }
}
