import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getPublicTenant, getCatalog } = vi.hoisted(() => ({ getPublicTenant: vi.fn(), getCatalog: vi.fn() }));
vi.mock('@/lib/public-tenant', () => ({ getPublicTenant }));
vi.mock('@/lib/catalog', () => ({ getCatalog, formatPrice: () => 'Rp100', scheduleLabels: () => [] }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND'); } }));
const { default: Page, generateMetadata } = await import('./page');
const props = { params: Promise.resolve({ id: 'tenant-1' }), searchParams: Promise.resolve({ page: '2' }) };

beforeEach(() => {
  vi.clearAllMocks();
  getPublicTenant.mockResolvedValue({ data: { id: 'tenant-1', name: 'School', address: 'Street' } });
  getCatalog.mockResolvedValue({ data: { items: [], pagination: { page: 2, total_pages: 3, total_items: 30 } } });
});
describe('public tenant profile', () => {
  it('renders the profile, published classes and tenant-scoped pagination', async () => {
    getCatalog.mockResolvedValue({ data: { items: [{ id: 'class-1', tenant_id: 'tenant-1', tenant_name: 'School', name: 'Math', schedules: [], category_name: 'Math', type: 'group', price: 100, is_enrollable: true }], pagination: { page: 2, total_pages: 3, total_items: 30 } } });
    const html = renderToStaticMarkup(await Page(props));
    expect(html).toContain('School'); expect(html).toContain('Street'); expect(html).toContain('Math');
    expect(html).toContain('/tenant/tenant-1?page=3');
    expect(getCatalog).toHaveBeenCalledWith({ tenant_id: 'tenant-1', page: '2' });
  });
  it('uses actual notFound for inactive or missing tenants and does not fetch classes', async () => {
    getPublicTenant.mockResolvedValue({ error: 'not_found' });
    await expect(Page(props)).rejects.toThrow('NEXT_NOT_FOUND'); expect(getCatalog).not.toHaveBeenCalled();
  });
  it('shows empty and missing-location states', async () => {
    getPublicTenant.mockResolvedValue({ data: { id: 'tenant-1', name: 'School' } });
    const html = renderToStaticMarkup(await Page(props));
    expect(html).toContain('Lokasi belum tersedia'); expect(html).toContain('Belum ada kelas');
  });
  it('keeps upstream failure distinct from not-found', async () => {
    getPublicTenant.mockResolvedValue({ error: 'api' });
    expect(renderToStaticMarkup(await Page(props))).toContain('Profil belum dapat dimuat');
    expect(getCatalog).not.toHaveBeenCalled();
  });
  it('shows catalog failure or invalid page without hiding profile', async () => {
    for (const error of ['api', 'invalid_filter']) {
      getCatalog.mockResolvedValue({ error });
      const html = renderToStaticMarkup(await Page(props));
      expect(html).toContain('School'); expect(html).toContain('role="alert"');
    }
  });
  it('generates tenant-specific metadata and noindexes unavailable profiles', async () => {
    expect(await generateMetadata(props)).toMatchObject({ title: 'School | KelolaKelas' });
    getPublicTenant.mockResolvedValue({ error: 'not_found' });
    expect(await generateMetadata(props)).toMatchObject({ robots: { index: false } });
  });
});
