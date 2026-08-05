import type { CatalogClass } from '@/lib/api/types';
import Link from 'next/link';
import { formatDistance, formatPrice } from '../_lib/formatters';

export function ClassCard({ item }: { item: CatalogClass }) {
  const distance = formatDistance(item.distance_km);
  return (
    <article className="flex min-h-72 flex-col rounded-2xl border border-[#dfe3d7] bg-white p-5 shadow-[0_8px_0_#e9eddf]">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#71863a]">{item.category_name}</p><h2 className="mt-2 line-clamp-2 text-xl font-black leading-tight text-[#17231f]">{item.name}</h2></div>
        <span className="shrink-0 rounded-full bg-[#f3d18b] px-2.5 py-1 text-xs font-bold text-[#62460b]">{item.type}</span>
      </div>
      <div className="mt-5 space-y-2 text-sm text-[#52615b]"><p className="font-semibold text-[#17231f]">{item.tenant_name}</p><p className="line-clamp-2">{item.tenant_address || 'Lokasi tenant belum tersedia'}</p></div>
      <div className="mt-auto pt-5"><div className="flex flex-wrap items-end justify-between gap-3"><p className="text-lg font-black text-[#17231f]">{formatPrice(item.price)}<span className="ml-1 text-xs font-medium text-[#718078]">/ bulan</span></p><div className="text-right text-xs text-[#65726c]">{item.available_slots != null && <p>{item.available_slots} slot tersedia</p>}{distance && <p>{distance}</p>}</div></div><div className="mt-4 flex items-center justify-between gap-3"><span className={item.is_enrollable ? 'text-xs font-bold text-[#55721f]' : 'text-xs font-bold text-[#a44d32]'}>{item.is_enrollable ? 'Bisa di-enroll' : 'Tidak tersedia'}</span><Link href={`/classes/${item.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-[#17231f] px-4 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#71863a]">Lihat detail</Link></div></div>
    </article>
  );
}