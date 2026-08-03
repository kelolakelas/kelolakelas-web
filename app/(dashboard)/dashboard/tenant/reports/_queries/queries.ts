import { apiRequest, unwrapList } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { QueryResult, Report } from '@/lib/api/types';

export async function getReports(options: { page?: number; search?: string; student_id?: string; enrollment_id?: string; date_from?: string; date_to?: string } = {}): Promise<QueryResult<Report[]>> {
  const params = new URLSearchParams({ page: String(options.page || 1), page_size: '20' });
  for (const key of ['search', 'student_id', 'enrollment_id', 'date_from', 'date_to'] as const) if (options[key]) params.set(key, options[key] as string);
  try { const response = await apiRequest<Report[] | { items: Report[]; pagination?: QueryResult<Report[]>['pagination'] }>(`/api/v1/reports?${params}`); return unwrapList(response.data); } catch (error) { return { data: [], error: error instanceof ApiError ? error.message : 'Report gagal dimuat.', status: error instanceof ApiError ? error.status : undefined }; }
}

export async function getReport(id: string): Promise<QueryResult<Report | null>> {
  try { const response = await apiRequest<Report>(`/api/v1/reports/${id}`); return { data: response.data || null }; } catch (error) { return { data: null, error: error instanceof ApiError ? error.message : 'Detail report gagal dimuat.', status: error instanceof ApiError ? error.status : undefined }; }
}