'use client';

import type { Pagination } from '@/lib/api/types';
import Link from 'next/link';

export function PaginationControls({ pagination, basePath }: { pagination?: Pagination; basePath: string }) {
  const page = pagination?.page || 1;
  const totalPages = pagination?.total_pages || 1;
  if (totalPages <= 1) return null;
  const makeHref = (nextPage: number) => `${basePath}?page=${nextPage}&page_size=${pagination?.page_size || 20}`;
  return <nav aria-label="Pagination" className="flex items-center justify-between border-t border-gray-200 pt-4 text-sm"><span>Halaman {page} dari {totalPages}</span><div className="flex gap-2"><Link aria-disabled={page <= 1} className={`min-h-11 rounded-lg border px-3 py-2 ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`} href={makeHref(Math.max(1, page - 1))}>Sebelumnya</Link><Link aria-disabled={page >= totalPages} className={`min-h-11 rounded-lg border px-3 py-2 ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`} href={makeHref(Math.min(totalPages, page + 1))}>Berikutnya</Link></div></nav>;
}
