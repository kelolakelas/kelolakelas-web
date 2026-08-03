import { apiRequest, unwrapList } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { Enrollment, QueryResult, Student } from '@/lib/api/types';
import { getClasses } from '../../classes/_queries/queries';
import { getStudents } from '../../students/_queries/queries';

export async function getEnrollments(options: { page?: number; search?: string; status?: string; class_id?: string; student_id?: string } = {}): Promise<QueryResult<Enrollment[]>> {
  const params = new URLSearchParams({ page: String(options.page || 1), page_size: '20' });
  for (const key of ['search', 'status', 'class_id', 'student_id'] as const) if (options[key]) params.set(key, options[key] as string);
  try {
    const response = await apiRequest<Enrollment[] | { items: Enrollment[]; pagination?: QueryResult<Enrollment[]>['pagination'] }>(`/api/v1/enrollments?${params}`);
    return unwrapList(response.data);
  } catch (error) {
    return { data: [], error: error instanceof ApiError ? error.message : 'Enrollment gagal dimuat.', status: error instanceof ApiError ? error.status : undefined };
  }
}

export async function getEnrollmentOptions(): Promise<{ students: QueryResult<Student[]>; classes: Awaited<ReturnType<typeof getClasses>> }> {
  const [students, classes] = await Promise.all([getStudents(), getClasses()]);
  return { students, classes };
}