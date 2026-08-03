import { apiRequest, unwrapList } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { Attendance, QueryResult } from '@/lib/api/types';

export async function getAttendance(options: { page?: number; student_id?: string; enrollment_id?: string; schedule_id?: string; status?: string; date_from?: string; date_to?: string } = {}): Promise<QueryResult<Attendance[]>> {
  const params = new URLSearchParams({ page: String(options.page || 1), page_size: '20' });
  for (const key of ['student_id', 'enrollment_id', 'schedule_id', 'status', 'date_from', 'date_to'] as const) if (options[key]) params.set(key, options[key] as string);
  try { const response = await apiRequest<Attendance[] | { items: Attendance[]; pagination?: QueryResult<Attendance[]>['pagination'] }>(`/api/v1/attendance?${params}`); return unwrapList(response.data); } catch (error) { return { data: [], error: error instanceof ApiError ? error.message : 'Attendance gagal dimuat.', status: error instanceof ApiError ? error.status : undefined }; }
}