'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useTransition } from 'react';
import { LocationSearchButton } from './LocationSearchButton';

export function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const update = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of form.entries()) if (typeof value === 'string' && value.trim()) next.set(key, value.trim());
    next.set('page', '1');
    startTransition(() => router.push(`${pathname}?${next}`));
  };
  return <form onSubmit={update} className="grid gap-3 rounded-2xl border border-[#dfe3d7] bg-[#eef1e8] p-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy={isPending}>
    <div className="sm:col-span-2 lg:col-span-4"><label htmlFor="search" className="mb-1 block text-sm font-bold text-[#17231f]">Cari kelas</label><input id="search" name="search" defaultValue={params.get('search') || ''} className="min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3 text-sm outline-none focus:border-[#71863a] focus:ring-2 focus:ring-[#d9f25b]" placeholder="Nama kelas atau mata pelajaran" /></div>
    <div><label htmlFor="category_id" className="mb-1 block text-sm font-bold text-[#17231f]">ID kategori</label><input id="category_id" name="category_id" defaultValue={params.get('category_id') || ''} className="min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3 text-sm" placeholder="Opsional" /></div>
    <div><label htmlFor="type" className="mb-1 block text-sm font-bold text-[#17231f]">Tipe kelas</label><select id="type" name="type" defaultValue={params.get('type') || ''} className="min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3 text-sm"><option value="">Semua tipe</option><option value="group">Group</option><option value="private">Private</option></select></div>
    <div><label htmlFor="min_price" className="mb-1 block text-sm font-bold text-[#17231f]">Harga minimum</label><input id="min_price" name="min_price" type="number" min="0" defaultValue={params.get('min_price') || ''} className="min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3 text-sm" /></div>
    <div><label htmlFor="max_price" className="mb-1 block text-sm font-bold text-[#17231f]">Harga maksimum</label><input id="max_price" name="max_price" type="number" min="0" defaultValue={params.get('max_price') || ''} className="min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3 text-sm" /></div>
    <div><label htmlFor="sort" className="mb-1 block text-sm font-bold text-[#17231f]">Urutkan</label><select id="sort" name="sort" defaultValue={params.get('sort') || 'newest'} className="min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3 text-sm"><option value="newest">Terbaru</option><option value="name_asc">Nama</option><option value="price_asc">Harga terendah</option><option value="price_desc">Harga tertinggi</option><option value="distance_asc">Terdekat</option></select></div>
    <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3"><LocationSearchButton /><button type="submit" className="min-h-11 rounded-xl bg-[#17231f] px-5 text-sm font-bold text-white disabled:opacity-60" disabled={isPending}>{isPending ? 'Memuat...' : 'Terapkan filter'}</button></div>
  </form>;
}