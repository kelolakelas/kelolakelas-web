'use server';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { revalidatePath } from 'next/cache';
import { reportSchema, reportUpdateSchema } from '../_schemas/schema';

export interface ReportActionResponse { success: boolean; message: string; errors?: Record<string, string[]>; }

export async function saveReport(_previous: ReportActionResponse, formData: FormData): Promise<ReportActionResponse> {
  const id = String(formData.get('id') || '');
  const schema = id ? reportUpdateSchema : reportSchema;
  const raw = { enrollment_id: formData.get('enrollment_id'), title: formData.get('title'), evaluation_notes: formData.get('evaluation_notes') || undefined, score: formData.get('score') || undefined };
  const validation = schema.safeParse(raw);
  if (!validation.success) return { success: false, message: 'Periksa data report.', errors: validation.error.flatten().fieldErrors };
  try { await apiRequest(id ? `/api/v1/reports/${id}` : '/api/v1/reports', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(validation.data) }); revalidatePath('/dashboard/tenant/reports'); return { success: true, message: id ? 'Report berhasil diperbarui.' : 'Report berhasil dibuat.' }; } catch (error) { return { success: false, message: error instanceof ApiError ? error.message : 'Report gagal disimpan.' }; }
}

export async function deleteReport(_previous: ReportActionResponse, formData: FormData): Promise<ReportActionResponse> {
  const id = String(formData.get('id') || '');
  if (!id) return { success: false, message: 'Report tidak valid.' };
  try { await apiRequest(`/api/v1/reports/${id}`, { method: 'DELETE' }); revalidatePath('/dashboard/tenant/reports'); return { success: true, message: 'Report berhasil dihapus.' }; } catch (error) { return { success: false, message: error instanceof ApiError ? error.message : 'Report gagal dihapus.' }; }
}