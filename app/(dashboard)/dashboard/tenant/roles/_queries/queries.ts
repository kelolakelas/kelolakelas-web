import { apiRequest, unwrapList } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { QueryResult } from '@/lib/api/types';
import type { Permission, Role } from '../_lib/schema';

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
 * Fetches all available system permissions from the Identity API Gateway.
 * Target Endpoint: GET /api/v1/permissions
 */
export async function getAvailablePermissions(options?: ListOptions): Promise<QueryResult<Permission[]>> {
  return getList<Permission>('/api/v1/permissions', options);
}

/**
 * Fetches all roles (system and custom) configured for the active tenant.
 * Target Endpoint: GET /api/v1/roles
 */
export async function getTenantRoles(options?: ListOptions): Promise<QueryResult<Role[]>> {
  return getList<Role>('/api/v1/roles', options);
}
