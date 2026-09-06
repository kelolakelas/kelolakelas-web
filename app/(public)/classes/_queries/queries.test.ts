import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }));

import { apiRequest } from '@/lib/api/client';
import { catalogFiltersSchema } from '../_schemas/schema';
import { buildCatalogQuery, getCatalogClasses } from './queries';

describe('catalog queries', () => {
  it('omits empty filters and preserves valid pagination', () => {
    expect(buildCatalogQuery({ search: '', page: 2, page_size: 20 })).toBe('page=2&page_size=20');
  });

  it('rejects incomplete location filters', () => {
    expect(() => buildCatalogQuery({ latitude: -6 })).toThrow();
  });

  it('rejects invalid radius, price range, and sort', () => {
    expect(() => catalogFiltersSchema.parse({ radius_km: 101 })).toThrow();
    expect(() => catalogFiltersSchema.parse({ min_price: 20, max_price: 10 })).toThrow();
    expect(() => catalogFiltersSchema.parse({ sort: 'random' })).toThrow();
  });

  it('unwraps catalog response and maps API errors', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: 'success', data: { items: [{ id: 'class-1', schedules: JSON.stringify([{ id: 'schedule-1', day_of_week: 1, start_time: '16:00:00', end_time: '17:30:00', capacity: 10, available_slots: 7, is_available: true }]) }], pagination: { page: 1, total_pages: 1 } } });
    await expect(getCatalogClasses({ page: 1 })).resolves.toMatchObject({ data: [{ id: 'class-1', schedules: [{ id: 'schedule-1', day_of_week: 1, available_slots: 7 }] }], pagination: { total_pages: 1 } });

    vi.mocked(apiRequest).mockRejectedValueOnce(new Error('network'));
    await expect(getCatalogClasses()).resolves.toMatchObject({ data: [], error: 'Katalog kelas gagal dimuat.' });
  });
});