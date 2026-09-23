import { describe, expect, it } from 'vitest';
import type { CatalogItem } from './catalog';
import { CATALOG_DESCRIPTION, DEFAULT_APP_URL, catalogListMetadata, classDetailMetadata, getAppUrl, metaDescription } from './site-metadata';

const APP_URL = 'https://kelas.example.test';

const item: CatalogItem = {
  id: 'class-1',
  tenant_id: 'tenant-1',
  tenant_name: 'Bimbel Cerdas',
  category_name: 'Matematika',
  name: 'Matematika Dasar',
  description: { text: 'Belajar pecahan dan desimal.' },
  type: 'group',
  price: 150000,
  schedules: [],
  is_enrollable: true,
};

describe('getAppUrl', () => {
  it('falls back to the local origin when NEXT_PUBLIC_APP_URL is unset, blank, or invalid', () => {
    expect(getAppUrl(undefined)).toBe(DEFAULT_APP_URL);
    expect(getAppUrl('  ')).toBe(DEFAULT_APP_URL);
    expect(getAppUrl('not a url')).toBe(DEFAULT_APP_URL);
    expect(getAppUrl('javascript:alert(1)')).toBe(DEFAULT_APP_URL);
  });

  it('normalises a configured origin without a trailing slash', () => {
    expect(getAppUrl('https://kelas.example.test/')).toBe(APP_URL);
    expect(getAppUrl('https://kelas.example.test/app/')).toBe(`${APP_URL}/app`);
  });
});

describe('metaDescription', () => {
  it('strips markup and control characters and collapses whitespace', () => {
    expect(metaDescription('  <b>Belajar</b>\n\tpecahan  ')).toBe('Belajar pecahan');
  });

  it('returns null for empty input', () => {
    expect(metaDescription(null)).toBeNull();
    expect(metaDescription('   ')).toBeNull();
    expect(metaDescription('<p></p>')).toBeNull();
  });

  it('bounds long text to 160 characters', () => {
    const text = metaDescription('a'.repeat(400));
    expect(text).toHaveLength(160);
    expect(text?.endsWith('…')).toBe(true);
  });
});

describe('catalogListMetadata', () => {
  it('uses the catalog title and an unfiltered canonical URL', () => {
    const metadata = catalogListMetadata(APP_URL);
    expect(metadata.title).toBe('Katalog Kelas - KelolaKelas');
    expect(metadata.alternates?.canonical).toBe(`${APP_URL}/kelas`);
    expect(metadata.openGraph).toMatchObject({ url: `${APP_URL}/kelas`, siteName: 'KelolaKelas', locale: 'id_ID' });
  });
});

describe('classDetailMetadata', () => {
  it('uses the displayed class name, description, and canonical URL', () => {
    const metadata = classDetailMetadata('class-1', { data: item }, APP_URL);
    expect(metadata.title).toBe('Matematika Dasar - KelolaKelas');
    expect(metadata.description).toBe('Belajar pecahan dan desimal.');
    expect(metadata.alternates?.canonical).toBe(`${APP_URL}/kelas/class-1`);
    expect(metadata.openGraph).toMatchObject({ title: 'Matematika Dasar - KelolaKelas', url: `${APP_URL}/kelas/class-1` });
    expect(metadata.robots).toBeUndefined();
  });

  it('builds a description from the class and tenant when the class has none', () => {
    const metadata = classDetailMetadata('class-1', { data: { ...item, description: { html: '<b>x</b>' } } }, APP_URL);
    expect(metadata.description).toBe('Kelas Matematika Dasar oleh Bimbel Cerdas di KelolaKelas.');
  });

  it('sanitises class fields used in metadata', () => {
    const metadata = classDetailMetadata('class-1', { data: { ...item, name: '<script>x</script>Kelas\nA', description: '<i>Deskripsi</i>' } }, APP_URL);
    expect(metadata.title).toBe('x Kelas A - KelolaKelas');
    expect(metadata.description).toBe('Deskripsi');
  });

  it('encodes the id in the canonical URL', () => {
    expect(classDetailMetadata('a b/c', { data: item }, APP_URL).alternates?.canonical).toBe(`${APP_URL}/kelas/a%20b%2Fc`);
  });

  it('marks a missing class as not found and not indexable', () => {
    const metadata = classDetailMetadata('missing', { error: 'not_found' }, APP_URL);
    expect(metadata.title).toBe('Kelas tidak ditemukan - KelolaKelas');
    expect(metadata.description).toBe(CATALOG_DESCRIPTION);
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it('keeps a generic, non-indexable title when the catalog API fails', () => {
    const metadata = classDetailMetadata('class-1', { error: 'api' }, APP_URL);
    expect(metadata.title).toBe('Detail kelas - KelolaKelas');
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
