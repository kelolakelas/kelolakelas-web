'use server';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { revalidatePath } from 'next/cache';
import { attendanceSchema, attendanceUpdateSchema } from '../_schemas/schema';

export interface AttendanceActionResponse { success: boolean; message: string; errors?: Record<string, string[]>; }
export async function createAttendance(_previous: AttendanceActionResponse, formData: FormData): Promise<AttendanceActionResponse> { const validation = attendanceSchema.safeParse(Object.fromEntries(formData)); if (!validation.success) return { success: false, message: 'Periksa data attendance.', errors: validation.error.flatten().fieldErrors }; try { await apiRequest('/api/v1/attendance', { method: 'POST', body: JSON.stringify(validation.data) }); revalidatePath('/dashboard/tenant/attendance'); return { success: true, message: 'Attendance berhasil dicatat.' }; } catch (error) { return { success: false, message: error instanceof ApiError ? error.message : 'Attendance gagal dicatat.' }; } }
export async function updateAttendance(_previous: AttendanceActionResponse, formData: FormData): Promise<AttendanceActionResponse> { const id = String(formData.get('id') || ''); const validation = attendanceUpdateSchema.safeParse({ status: formData.get('status') }); if (!id || !validation.success) return { success: false, message: 'Attendance tidak valid.' }; try { await apiRequest(`/api/v1/attendance/${id}`, { method: 'PATCH', body: JSON.stringify(validation.data) }); revalidatePath('/dashboard/tenant/attendance'); return { success: true, message: 'Attendance berhasil diperbarui.' }; } catch (error) { return { success: false, message: error instanceof ApiError ? error.message : 'Attendance gagal diperbarui.' }; } }