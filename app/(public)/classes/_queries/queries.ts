import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { CatalogClass, CatalogListResponse, QueryResult } from '@/lib/api/types';
import { catalogFiltersSchema, type CatalogFilters } from '../_schemas/schema';

export function buildCatalogQuery(options: CatalogFilters = {}): string {
  const filters = catalogFiltersSchema.parse(options);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export async function getCatalogClasses(options: CatalogFilters = {}): Promise<QueryResult<CatalogClass[]>> {
  try {
    const query = buildCatalogQuery(options);
    const response = await apiRequest<CatalogListResponse>(`/api/v1/catalog/classes${query ? `?${query}` : ''}`, {
      includeTenant: false,
      next: { revalidate: 60 },
    });
    return { data: response.data?.items || [], pagination: response.data?.pagination };
  } catch (error) {
    return { data: [], error: error instanceof ApiError ? error.message : 'Katalog kelas gagal dimuat.', status: error instanceof ApiError ? error.status : undefined };
  }
}

export async function getCatalogClass(id: string): Promise<QueryResult<CatalogClass | null>> {
  try {
    const response = await apiRequest<CatalogClass>(`/api/v1/catalog/classes/${encodeURIComponent(id)}`, {
      includeTenant: false,
      next: { revalidate: 60 },
    });
    return { data: response.data || null };
  } catch (error) {
    return { data: null, error: error instanceof ApiError ? error.message : 'Detail kelas gagal dimuat.', status: error instanceof ApiError ? error.status : undefined };
  }
}