import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicTenant } from '@/lib/public-tenant';
import { getCatalog } from '@/lib/catalog';
import { CatalogCard } from '../../kelas/_components/CatalogCard';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { id } = await params;
  const result = await getPublicTenant(id);
  return result.data
    ? { title: `${result.data.name} | KelolaKelas`, description: `Lihat kelas yang dipublikasikan oleh ${result.data.name}.` }
    : { title: 'Profil tenant | KelolaKelas', robots: { index: false, follow: false } };
}

export default async function TenantProfile({ params, searchParams }: Props) {
  const { id } = await params;
  const profile = await getPublicTenant(id);
  if (profile.error === 'not_found') notFound();
  if (!profile.data) return <main className="mx-auto max-w-5xl px-5 py-16"><h1 className="text-3xl font-black">Profil belum dapat dimuat</h1><p className="mt-3">Silakan coba lagi nanti.</p><Link href="/kelas" className="mt-6 inline-block underline">Kembali ke katalog</Link></main>;
  const { page } = await searchParams;
  const classes = await getCatalog({ tenant_id: id, page });
  const tenant = profile.data;
  const pagination = classes.data?.pagination;
  return <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f]">
    <div className="mx-auto max-w-5xl">
      <Link href="/kelas" className="font-bold text-[#617c35] hover:underline">← Semua kelas</Link>
      <section className="mt-8 rounded-3xl border border-[#dfe3d7] bg-white p-8">
        <h1 className="text-4xl font-black">{tenant.name}</h1>
        {tenant.address ? <p className="mt-4 text-[#52615b]">{tenant.address}</p> : <p className="mt-4 text-[#52615b]">Lokasi belum tersedia.</p>}
      </section>
      <section className="mt-10" aria-labelledby="published-classes">
        <h2 id="published-classes" className="text-2xl font-black">Kelas yang dipublikasikan</h2>
        {classes.error ? <p className="mt-4" role="alert">{classes.error === 'invalid_filter' ? 'Nomor halaman tidak valid.' : 'Kelas belum dapat dimuat. Silakan coba lagi.'}</p>
          : classes.data.items.length ? <div className="mt-6 grid gap-5 sm:grid-cols-2">{classes.data.items.map(item => <CatalogCard key={item.id} item={item} />)}</div>
            : <p className="mt-4">Belum ada kelas yang dipublikasikan pada halaman ini.</p>}
        {pagination && pagination.total_pages > 1 && <nav aria-label="Halaman kelas" className="mt-6 flex gap-5">
          {pagination.page > 1 && <Link className="underline" href={`/tenant/${encodeURIComponent(id)}?page=${pagination.page - 1}`}>Sebelumnya</Link>}
          <span>Halaman {pagination.page} dari {pagination.total_pages}</span>
          {pagination.page < pagination.total_pages && <Link className="underline" href={`/tenant/${encodeURIComponent(id)}?page=${pagination.page + 1}`}>Berikutnya</Link>}
        </nav>}
      </section>
    </div>
  </main>;
}
