import type { Pagination } from '@/lib/api/types';
import Link from 'next/link';

export function CatalogPagination({ pagination, searchParams }: { pagination?: Pagination; searchParams: Record<string, string> }) {
  const page = pagination?.page || 1; const totalPages = pagination?.total_pages || 1;
  const link = (target: number) => { const params = new URLSearchParams(searchParams); params.set('page', String(target)); return `/classes?${params}`; };
  return <nav className="flex items-center justify-between border-t border-[#dfe3d7] pt-5" aria-label="Pagination"><Link aria-disabled={page <= 1} className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-bold ${page <= 1 ? 'pointer-events-none opacity-40' : 'bg-white'}`} href={link(Math.max(1, page - 1))}>Sebelumnya</Link><span className="text-sm font-semibold text-[#65726c]">Halaman {page} dari {totalPages}</span><Link aria-disabled={page >= totalPages} className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-bold ${page >= totalPages ? 'pointer-events-none opacity-40' : 'bg-white'}`} href={link(Math.min(totalPages, page + 1))}>Berikutnya</Link></nav>;
}