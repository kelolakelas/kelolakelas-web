import { apiRequest, unwrapList } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { Member, QueryResult } from '@/lib/api/types';
import type { Category, ClassEntity, ClassSchedule } from '../_lib/schema';

interface ListOptions { page?: number; pageSize?: number; search?: string }

function withListQuery(path: string, options: ListOptions = {}): string {
  const params = new URLSearchParams({ page: String(options.page || 1), page_size: String(options.pageSize || 20) });
  if (options.search?.trim()) params.set('search', options.search.trim());
  return `${path}?${params.toString()}`;
}

async function getList<T>(path: string, options?: ListOptions): Promise<QueryResult<T[]>> {
  try {
    const response = await apiRequest<T[] | { items: T[]; pagination?: QueryResult<T[]>['pagination'] }>(withListQuery(path, options));
    return unwrapList(response.data);
  } catch (error) {
    return {
      data: [],
      error: error instanceof ApiError ? error.message : 'Data gagal dimuat.',
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}

/**
 * Fetches all academic categories configured for the current tenant.
 */
export async function getCategories(options?: ListOptions): Promise<QueryResult<Category[]>> {
  return getList<Category>('/api/v1/categories', options);
}

/**
 * Fetches all academic classes created for the current tenant.
 */
export async function getClasses(options?: ListOptions): Promise<QueryResult<ClassEntity[]>> {
  return getList<ClassEntity>('/api/v1/classes', options);
}

/**
 * Fetches initial recurring schedules for the tenant.
 */
export async function getSchedules(options?: ListOptions): Promise<QueryResult<ClassSchedule[]>> {
  return getList<ClassSchedule>('/api/v1/schedules', options);
}

export async function getTutors(): Promise<QueryResult<Member[]>> {
  try {
    const response = await apiRequest<Member[] | { items: Member[] }>('/api/v1/tutors?page=1&page_size=100');
    return unwrapList(response.data);
  } catch (error) {
    return {
      data: [],
      error: error instanceof ApiError ? error.message : 'Teacher gagal dimuat.',
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}
