import type { Metadata } from 'next';
import { descriptionText, type CatalogItem, type CatalogResult } from './catalog';

export const SITE_NAME = 'KelolaKelas';
export const SITE_LOCALE = 'id_ID';
export const DEFAULT_APP_URL = 'http://localhost:3000';
export const DEFAULT_DESCRIPTION =
  'KelolaKelas membantu parent menemukan dan mendaftar kelas, serta membantu lembaga pendidikan mengelola kelas, jadwal, dan pembayaran.';
export const CATALOG_DESCRIPTION =
  'Temukan kelas privat dan grup dari lembaga pendidikan di KelolaKelas, lengkap dengan harga dan jadwal.';

const DESCRIPTION_LIMIT = 160;

/**
 * Absolute origin used for canonical and Open Graph URLs.
 *
 * Mirrors the `NEXT_PUBLIC_APP_URL || default` resolution already used by the auth pages, and additionally
 * rejects values that are not absolute http(s) URLs so a misconfigured variable cannot produce a broken canonical.
 */
export function getAppUrl(value: string | undefined = process.env.NEXT_PUBLIC_APP_URL): string {
  const candidate = value?.trim();
  if (!candidate) return DEFAULT_APP_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return DEFAULT_APP_URL;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return DEFAULT_APP_URL;
  }
}

/** Plain, single-line, length-bounded text for `<meta>` descriptions. Returns null when nothing usable is left. */
export function metaDescription(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  if (text.length <= DESCRIPTION_LIMIT) return text;
  return `${text.slice(0, DESCRIPTION_LIMIT - 1).trimEnd()}…`;
}

function pageMetadata(title: string, description: string, path: string, appUrl: string): Metadata {
  const url = `${appUrl}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, locale: SITE_LOCALE, type: 'website' },
  };
}

export function catalogListMetadata(appUrl: string = getAppUrl()): Metadata {
  // Filters and pagination are views of the same catalog, so they all share the unfiltered canonical URL.
  return pageMetadata(`Katalog Kelas - ${SITE_NAME}`, CATALOG_DESCRIPTION, '/kelas', appUrl);
}

export function classDetailMetadata(id: string, result: CatalogResult<CatalogItem>, appUrl: string = getAppUrl()): Metadata {
  const path = `/kelas/${encodeURIComponent(id)}`;
  if (result.error === 'not_found') {
    return { ...pageMetadata(`Kelas tidak ditemukan - ${SITE_NAME}`, CATALOG_DESCRIPTION, path, appUrl), robots: { index: false, follow: true } };
  }
  if (result.error || !result.data) {
    return { ...pageMetadata(`Detail kelas - ${SITE_NAME}`, CATALOG_DESCRIPTION, path, appUrl), robots: { index: false, follow: true } };
  }
  const item = result.data;
  const name = metaDescription(item.name) ?? 'Detail kelas';
  const tenant = metaDescription(item.tenant_name);
  const description = metaDescription(descriptionText(item.description))
    ?? metaDescription(tenant ? `Kelas ${name} oleh ${tenant} di ${SITE_NAME}.` : `Kelas ${name} di ${SITE_NAME}.`)
    ?? CATALOG_DESCRIPTION;
  return pageMetadata(`${name} - ${SITE_NAME}`, description, path, appUrl);
}
