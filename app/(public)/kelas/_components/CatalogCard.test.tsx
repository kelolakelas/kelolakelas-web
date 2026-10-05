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
    expect(html).toContain('href="/tenant/tenant%201">Bimbel Cerdas</a>');
    expect(html).toContain('<h2');
    expect(html).toContain('href="/kelas/class-1"');
  });
});

describe('CatalogCard rating badge (KEL-160)', () => {
  it('renders the accessible average badge when an average is present', () => {
    const html = renderToStaticMarkup(<CatalogCard item={{ ...item, rating_average: 4.5, rating_count: 12 }} />);
    expect(html).toContain('aria-label="Rating rata-rata 4,5 dari 5"');
    expect(html).toContain('4,5');
  });

  it('omits the badge when the average is absent', () => {
    const html = renderToStaticMarkup(<CatalogCard item={item} />);
    expect(html).not.toContain('Rating rata-rata');
  });

  it('omits the badge when the average is null or non-finite', () => {
    for (const rating_average of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const html = renderToStaticMarkup(<CatalogCard item={{ ...item, rating_average }} />);
      expect(html).not.toContain('Rating rata-rata');
    }
  });
});
