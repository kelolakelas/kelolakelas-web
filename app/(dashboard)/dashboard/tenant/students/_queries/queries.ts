import { apiRequest, unwrapList } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { QueryResult, Student } from '@/lib/api/types';

export async function getStudents(options: { page?: number; search?: string } = {}): Promise<QueryResult<Student[]>> {
  const params = new URLSearchParams({ page: String(options.page || 1), page_size: '20' });
  if (options.search?.trim()) params.set('search', options.search.trim());
  try {
    const response = await apiRequest<Student[] | { items: Student[]; pagination?: QueryResult<Student[]>['pagination'] }>(`/api/v1/students?${params}`);
    return unwrapList(response.data);
  } catch (error) {
    return { data: [], error: error instanceof ApiError ? error.message : 'Student gagal dimuat.', status: error instanceof ApiError ? error.status : undefined };
  }
}

export async function getStudent(id: string): Promise<QueryResult<Student | null>> {
  try {
    const response = await apiRequest<Student>(`/api/v1/students/${id}`);
    return { data: response.data || null };
  } catch (error) {
    return { data: null, error: error instanceof ApiError ? error.message : 'Detail student gagal dimuat.', status: error instanceof ApiError ? error.status : undefined };
  }
}