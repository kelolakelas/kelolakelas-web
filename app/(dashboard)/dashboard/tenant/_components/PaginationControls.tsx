'use client';

import type { Pagination } from '@/lib/api/types';
import Link from 'next/link';

export function PaginationControls({ pagination, basePath, query = {} }: { pagination?: Pagination; basePath: string; query?: Record<string, string | undefined> }) {
  const page = pagination?.page || 1;
  const totalPages = pagination?.total_pages || 1;
  if (totalPages <= 1) return null;
  const makeHref = (nextPage: number) => {
    const params = new URLSearchParams({ page: String(nextPage), page_size: String(pagination?.page_size || 20) });
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return `${basePath}?${params.toString()}`;
  };
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  const totalItems = pagination?.total_items;

  return (
    <nav aria-label="Pagination member" className="flex flex-col gap-3 border-t border-gray-200 pt-4 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:text-gray-400">
      <p>
        Halaman <span className="font-semibold text-gray-900 dark:text-gray-100">{page}</span> dari {totalPages}
        {typeof totalItems === 'number' && <span className="text-gray-500 dark:text-gray-400"> · {totalItems} member</span>}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-3 font-medium transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800" href={makeHref(previousPage)}>
            Sebelumnya
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-3 font-medium text-gray-400 dark:border-gray-800">Sebelumnya</span>
        )}
        {page < totalPages ? (
          <Link className="inline-flex min-h-11 items-center rounded-lg bg-gray-900 px-3 font-medium text-white transition hover:bg-gray-700" href={makeHref(nextPage)}>
            Berikutnya
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center rounded-lg bg-gray-200 px-3 font-medium text-gray-400 dark:bg-gray-800">Berikutnya</span>
        )}
      </div>
    </nav>
  );
}
