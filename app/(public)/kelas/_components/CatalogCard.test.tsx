import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalogCard } from './CatalogCard';
import type { CatalogItem } from '@/lib/catalog';

const item: CatalogItem = {
  id: 'class-1',
  tenant_id: 'tenant 1',
  tenant_name: 'Bimbel Cerdas',
  category_name: 'Matematika',
  name: 'Aljabar Dasar',
  type: 'group',
  price: 100000,
  schedules: [],
  is_enrollable: true,
};

describe('CatalogCard tenant link', () => {
  it('links the accessible tenant name to its filtered public class list', () => {
    const html = renderToStaticMarkup(<CatalogCard item={item} />);
    expect(html).toContain('href="/kelas?tenant_id=tenant%201">Bimbel Cerdas</a>');
    expect(html).toContain('<h2');
    expect(html).toContain('href="/kelas/class-1"');
  });
});
