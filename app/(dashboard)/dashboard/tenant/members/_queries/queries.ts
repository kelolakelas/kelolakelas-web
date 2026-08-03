import { apiRequest, unwrapList } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { QueryResult } from '@/lib/api/types';
import type { Member, Permission, Role } from '../_schemas/schema';

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
    const message = error instanceof ApiError ? error.message : 'Data gagal dimuat.';
    return { data: [], error: message, status: error instanceof ApiError ? error.status : undefined };
  }
}

/**
 * Fetches current active members for the tenant organization from the API Gateway.
 */
export async function getTenantMembers(options?: ListOptions): Promise<QueryResult<Member[]>> {
  return getList<Member>('/api/v1/members', options);
}

/**
 * Fetches available roles configured for the tenant organization.
 * Target Endpoint: GET /api/v1/roles
 */
export async function getTenantRoles(options?: ListOptions): Promise<QueryResult<Role[]>> {
  return getList<Role>('/api/v1/roles', options);
}

/**
 * Fetches all available system permissions.
 * Target Endpoint: GET /api/v1/permissions
 */
export async function getSystemPermissions(options?: ListOptions): Promise<QueryResult<Permission[]>> {
  return getList<Permission>('/api/v1/permissions', options);
}
