import { getGatewayBaseUrl } from './gateway';

export type CatalogItem = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_address?: string;
  category_name: string;
  name: string;
  description?: unknown;
  type: 'private' | 'group';
  price: number;
  schedules: unknown;
  is_enrollable: boolean;
};

export type CatalogList = { items: CatalogItem[]; pagination: { page: number; total_pages: number; total_items: number } };
export type CatalogResult<T> = { data: T; error?: never } | { data?: never; error: 'invalid_filter' | 'not_found' | 'api' };

const SORTS = new Set(['newest', 'name_asc', 'price_asc', 'price_desc']);

export function catalogQuery(input: Record<string, string | string[] | undefined>) {
  const value = (key: string) => typeof input[key] === 'string' ? input[key].trim() : '';
  const params = new URLSearchParams({ page_size: '12' });
  const page = value('page') || '1';
  if (!/^\d+$/.test(page) || Number(page) < 1) return { error: true as const, params };
  params.set('page', page);
  for (const key of ['search', 'category_id', 'tenant_id']) if (value(key)) params.set(key, value(key));
  const type = value('type');
  if (type && type !== 'private' && type !== 'group') return { error: true as const, params };
  if (type) params.set('type', type);
  const sort = value('sort') || 'newest';
  if (!SORTS.has(sort)) return { error: true as const, params };
  params.set('sort', sort);
  for (const key of ['min_price', 'max_price']) {
    const number = value(key);
    if (number && (!/^\d+$/.test(number) || Number(number) < 0)) return { error: true as const, params };
    if (number) params.set(key, number);
  }
  if (Number(params.get('min_price') || 0) > Number(params.get('max_price') || Number.MAX_SAFE_INTEGER)) return { error: true as const, params };
  return { error: false as const, params };
}

async function request<T>(path: string): Promise<CatalogResult<T>> {
  try {
    const response = await fetch(`${getGatewayBaseUrl()}${path}`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (response.status === 404) return { error: 'not_found' };
    if (response.status === 400 || response.status === 422) return { error: 'invalid_filter' };
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.status !== 'success' || !body.data) return { error: 'api' };
    return { data: body.data as T };
  } catch {
    return { error: 'api' };
  }
}

export async function getCatalog(input: Record<string, string | string[] | undefined>): Promise<CatalogResult<CatalogList>> {
  const query = catalogQuery(input);
  return query.error ? { error: 'invalid_filter' } : request<CatalogList>(`/api/v1/catalog/classes?${query.params}`);
}

export async function getCatalogClass(id: string): Promise<CatalogResult<CatalogItem>> {
  return request<CatalogItem>(`/api/v1/catalog/classes/${encodeURIComponent(id)}`);
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price);
}

export function scheduleLabels(schedules: unknown): string[] {
  if (!Array.isArray(schedules)) return [];
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  return schedules.flatMap((schedule) => {
    if (!schedule || typeof schedule !== 'object') return [];
    const item = schedule as Record<string, unknown>;
    const day = typeof item.day_of_week === 'number' ? days[item.day_of_week - 1] : undefined;
    const start = typeof item.start_time === 'string' ? item.start_time.slice(0, 5) : undefined;
    const end = typeof item.end_time === 'string' ? item.end_time.slice(0, 5) : undefined;
    return day && start && end ? [`${day}, ${start}–${end}`] : [];
  });
}

export function descriptionText(description: unknown): string | null {
  if (typeof description === 'string') return description.trim() || null;
  if (description && typeof description === 'object' && 'text' in description) {
    const text = (description as { text?: unknown }).text;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  }
  return null;
}
