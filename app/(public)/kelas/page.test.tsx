import { describe, expect, it, vi } from 'vitest';

const getCatalog = vi.hoisted(() => vi.fn().mockResolvedValue({ error: 'invalid_filter' as const }));

vi.mock('@/lib/catalog', () => ({
  getCatalog,
  formatPrice: vi.fn(),
  scheduleLabels: vi.fn(() => []),
}));
vi.mock('@/lib/auth-session', () => ({ getSessionIdentityFromToken: vi.fn(() => null) }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: vi.fn() })) }));

const { default: CatalogPage } = await import('./page');

describe('public catalog page', () => {
  it('keeps the catalog page size fixed when the URL includes page_size', async () => {
    getCatalog.mockClear();

    await CatalogPage({ searchParams: Promise.resolve({ page_size: '101' }) });

    expect(getCatalog).toHaveBeenCalledWith({ page_size: '101' }, { pageSize: 12 });
  });
});
