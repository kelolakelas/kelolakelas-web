import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { QueryResult } from '@/lib/api/types';
import type { TenantSettings } from '../_lib/schema';

export async function getTenantSettings(): Promise<QueryResult<TenantSettings | null>> {
  try {
    const response = await apiRequest<TenantSettings>('/api/v1/tenant/settings');
    return { data: response.data || null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof ApiError ? error.message : 'Pengaturan gagal dimuat.',
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}