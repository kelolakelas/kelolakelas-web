import type { MetadataRoute } from 'next';
import { getCatalog, type CatalogItem } from '@/lib/catalog';
import { getAppUrl } from '@/lib/site-metadata';

const SITEMAP_PAGE_SIZE = 100;
// Re-read the public catalog at most hourly while keeping the sitemap available during outages.
export const revalidate = 3600;

const staticEntries = (appUrl: string): MetadataRoute.Sitemap => [
  { url: appUrl, priority: 1, changeFrequency: 'weekly' },
  { url: `${appUrl}/kelas`, priority: 0.9, changeFrequency: 'daily' },
];

async function getAllPublicCatalogItems(): Promise<CatalogItem[]> {
  const items: CatalogItem[] = [];
  let page = 1;

  while (true) {
    const result = await getCatalog(
      { page: String(page) },
      { pageSize: SITEMAP_PAGE_SIZE, revalidateSeconds: 3600, forwardClientIp: false },
    );
    if (result.error) throw new Error(`Public catalog unavailable: ${result.error}`);

    items.push(...result.data.items);
    if (page >= result.data.pagination.total_pages || result.data.pagination.total_pages < 1) return items;
    page += 1;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getAppUrl();

  try {
    const items = await getAllPublicCatalogItems();
    const seenIds = new Set<string>();
    const classEntries = items.flatMap((item) => {
      if (typeof item.id !== 'string' || !item.id || seenIds.has(item.id)) return [];
      seenIds.add(item.id);
      return [{ url: `${appUrl}/kelas/${encodeURIComponent(item.id)}`, changeFrequency: 'daily' as const, priority: 0.7 }];
    });
    return [...staticEntries(appUrl), ...classEntries];
  } catch {
    // Search engines should still receive the stable public pages during an API outage.
    return staticEntries(appUrl);
  }
}