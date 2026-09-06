import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { CatalogClass, CatalogListResponse, CatalogSchedule, QueryResult } from '@/lib/api/types';
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
    return { data: response.data?.items.map(normalizeCatalogClass) || [], pagination: response.data?.pagination };
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
    return { data: response.data ? normalizeCatalogClass(response.data) : null };
  } catch (error) {
    return { data: null, error: error instanceof ApiError ? error.message : 'Detail kelas gagal dimuat.', status: error instanceof ApiError ? error.status : undefined };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSchedules(value: unknown): CatalogSchedule[] {
  let source: unknown = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source) as unknown; } catch { return []; }
  }
  if (!Array.isArray(source)) return [];
  return source.flatMap((entry): CatalogSchedule[] => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.start_time !== 'string' || typeof entry.end_time !== 'string') return [];
    const day = entry.day_of_week;
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 7) return [];
    if (typeof entry.capacity !== 'number' || typeof entry.available_slots !== 'number' || typeof entry.is_available !== 'boolean') return [];
    return [{ id: entry.id, class_id: typeof entry.class_id === 'string' ? entry.class_id : undefined, day_of_week: day as CatalogSchedule['day_of_week'], start_time: entry.start_time, end_time: entry.end_time, capacity: entry.capacity, available_slots: entry.available_slots, is_available: entry.is_available, location: typeof entry.location === 'string' ? entry.location : null, tutor_id: typeof entry.tutor_id === 'string' ? entry.tutor_id : null }];
  });
}

function normalizeCatalogClass(item: CatalogClass): CatalogClass {
  return { ...item, schedules: parseSchedules((item as unknown as Record<string, unknown>).schedules) };
}