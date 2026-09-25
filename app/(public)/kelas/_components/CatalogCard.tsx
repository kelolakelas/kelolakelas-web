import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import { formatPrice, scheduleLabels, type CatalogItem } from '@/lib/catalog';

export function CatalogCard({ item }: { item: CatalogItem }) {
  const schedules = scheduleLabels(item.schedules);
  return <article className="rounded-3xl border border-[#dfe3d7] bg-white p-6 shadow-sm transition-transform hover:-translate-y-1">
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-[#617c35]">{item.category_name}</p><span className="rounded-full bg-[#eef3dd] px-3 py-1 text-xs font-bold capitalize">{item.type}</span></div>
    <h2 className="mt-4 text-2xl font-black tracking-[-0.04em]"><Link className="hover:underline" href={`/kelas/${item.id}`}>{item.name}</Link></h2>
    <p className="mt-2 font-semibold text-[#52615b]"><Link className="hover:underline" href={`/kelas?tenant_id=${encodeURIComponent(item.tenant_id)}`}>{item.tenant_name}</Link></p>
    {item.tenant_address && <p className="mt-3 flex gap-2 text-sm text-[#65726c]"><MapPin size={16} aria-hidden="true" />{item.tenant_address}</p>}
    <div className="mt-4 min-h-12 text-sm text-[#52615b]">{schedules.length ? <p className="flex gap-2"><CalendarDays size={16} aria-hidden="true" />{schedules.slice(0, 2).join(' · ')}</p> : <p>Jadwal akan dikonfirmasi penyelenggara.</p>}</div>
    <div className="mt-6 flex items-center justify-between border-t border-[#eef0e9] pt-4"><strong className="text-lg">{formatPrice(item.price)}</strong><Link className="rounded-full bg-[#17231f] px-4 py-2 text-sm font-bold text-white" href={`/kelas/${item.id}`}>{item.is_enrollable ? 'Lihat kelas' : 'Lihat detail'}</Link></div>
  </article>;
}
