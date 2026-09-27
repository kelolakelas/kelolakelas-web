import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/site-metadata';

export default function robots(): MetadataRoute.Robots {
  const appUrl = getAppUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/login', '/register', '/forgot-password', '/reset-password', '/invitations', '/platform'],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}