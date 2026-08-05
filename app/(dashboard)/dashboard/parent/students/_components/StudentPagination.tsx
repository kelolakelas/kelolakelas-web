import type { Pagination } from '@/lib/api/types';
import Link from 'next/link';

export function StudentPagination({ pagination, search }: { pagination?: Pagination; search?: string }) {
  const page = pagination?.page || 1;
  const totalPages = pagination?.total_pages || 1;
  const getHref = (target: number) => {
    const params = new URLSearchParams({ page: String(target) });
    if (search?.trim()) params.set('search', search.trim());
    return `/dashboard/parent/students?${params}`;
  };
  if (totalPages <= 1) return null;
  return <nav aria-label="Pagination student" className="flex items-center justify-between border-t border-gray-200 pt-4"><Link href={getHref(Math.max(1, page - 1))} aria-disabled={page <= 1} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'}`}>Sebelumnya</Link><span className="text-sm text-gray-600">Halaman {page} dari {totalPages}</span><Link href={getHref(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-gray-50'}`}>Berikutnya</Link></nav>;
}