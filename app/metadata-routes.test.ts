import { afterEach, describe, expect, it, vi } from 'vitest';
import robots from './robots';
import sitemap from './sitemap';

const gatewayUrl = process.env.GATEWAY_API_URL;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

function catalogResponse(page: number, totalPages: number, items: Array<{ id: string }>) {
  return new Response(JSON.stringify({
    status: 'success',
    data: { items, pagination: { page, total_pages: totalPages, total_items: items.length } },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.restoreAllMocks();
  if (gatewayUrl === undefined) delete process.env.GATEWAY_API_URL;
  else process.env.GATEWAY_API_URL = gatewayUrl;
  if (appUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = appUrl;
});

describe('robots metadata route', () => {
  it('allows public pages, blocks authenticated routes, and uses the absolute sitemap URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://kelas.example.test';

    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/login', '/register', '/forgot-password', '/reset-password', '/invitations', '/platform'],
      },
      sitemap: 'https://kelas.example.test/sitemap.xml',
    });
  });
});

describe('sitemap metadata route', () => {
  it('includes every public class across all catalog pages and requests at most 100 items', async () => {
    process.env.GATEWAY_API_URL = 'https://gateway.example.test';
    process.env.NEXT_PUBLIC_APP_URL = 'https://kelas.example.test';
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(catalogResponse(1, 2, [{ id: 'class-1' }]))
      .mockResolvedValueOnce(catalogResponse(2, 2, [{ id: 'class 2' }]));

    await expect(sitemap()).resolves.toEqual([
      { url: 'https://kelas.example.test', priority: 1, changeFrequency: 'weekly' },
      { url: 'https://kelas.example.test/kelas', priority: 0.9, changeFrequency: 'daily' },
      { url: 'https://kelas.example.test/kelas/class-1', changeFrequency: 'daily', priority: 0.7 },
      { url: 'https://kelas.example.test/kelas/class%202', changeFrequency: 'daily', priority: 0.7 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[0][0] as string).searchParams.get('page_size')).toBe('100');
    expect(fetchMock.mock.calls[0][1]).toEqual({ headers: { Accept: 'application/json' }, next: { revalidate: 3600 } });
  });

  it('returns only stable public pages when the catalog fails', async () => {
    process.env.GATEWAY_API_URL = 'https://gateway.example.test';
    process.env.NEXT_PUBLIC_APP_URL = 'https://kelas.example.test';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(sitemap()).resolves.toEqual([
      { url: 'https://kelas.example.test', priority: 1, changeFrequency: 'weekly' },
      { url: 'https://kelas.example.test/kelas', priority: 0.9, changeFrequency: 'daily' },
    ]);
  });

  it('returns only stable public pages for an empty catalog', async () => {
    process.env.GATEWAY_API_URL = 'https://gateway.example.test';
    process.env.NEXT_PUBLIC_APP_URL = 'https://kelas.example.test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(catalogResponse(1, 0, []));

    await expect(sitemap()).resolves.toHaveLength(2);
  });
});