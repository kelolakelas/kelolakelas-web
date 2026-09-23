import Link from 'next/link';
import { cookies } from 'next/headers';
import { CatalogCard } from './_components/CatalogCard';
import { getCatalog } from '@/lib/catalog';
import { getSessionIdentityFromToken } from '@/lib/auth-session';
import { LogoutButton } from '@/app/(auth)/logout/_components/LogoutButton';
import { catalogListMetadata } from '@/lib/site-metadata';

export const metadata = catalogListMetadata();

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CatalogPage({ searchParams }: Props) {
  const params = await searchParams;
  const result = await getCatalog(params);
  // The catalog is public, but it is also where a parent lands after signing in, so
  // a signed-in parent needs a way out of the session from here as well.
  const token = (await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  const isSignedInParent = Boolean(getSessionIdentityFromToken(token)?.isParent);
  const page = typeof params.page === 'string' && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  const query = new URLSearchParams(Object.entries(params).flatMap(([key, value]) => typeof value === 'string' && key !== 'page' ? [[key, value]] : []));
  const pageLink = (next: number) => { const value = new URLSearchParams(query); value.set('page', String(next)); return `/kelas?${value}`; };
  return <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f] sm:px-8 lg:px-10"><div className="mx-auto max-w-7xl"><div className="flex flex-wrap items-center justify-between gap-3"><Link className="text-sm font-bold text-[#617c35] hover:underline" href="/">← KelolaKelas</Link>{isSignedInParent && <LogoutButton className="rounded-xl border border-[#dfe3d7] bg-white px-4 py-2 text-sm font-bold text-[#617c35] hover:bg-[#eef4e8]" />}</div><header className="mt-7 max-w-3xl"><p className="text-sm font-bold uppercase tracking-[.16em] text-[#617c35]">Katalog publik</p><h1 className="mt-3 text-4xl font-black tracking-[-.055em] sm:text-6xl">Temukan kelas yang pas.</h1><div className="mt-5 flex gap-4"><Link className="text-sm font-bold text-[#617c35] hover:underline" href="/dashboard/parent/students">Kelola profil student →</Link><Link className="text-sm font-bold text-[#617c35] hover:underline" href="/dashboard/parent/enrollments">Status enrollment →</Link></div></header>
    <form className="mt-8 grid gap-3 rounded-3xl border border-[#dfe3d7] bg-white p-4 md:grid-cols-3 xl:grid-cols-6" action="/kelas"><input name="search" defaultValue={typeof params.search === 'string' ? params.search : ''} className="min-h-11 rounded-xl border border-[#c8d0c5] px-3 xl:col-span-2" placeholder="Cari nama kelas" /><select name="type" defaultValue={typeof params.type === 'string' ? params.type : ''} className="min-h-11 rounded-xl border border-[#c8d0c5] px-3"><option value="">Semua tipe</option><option value="group">Grup</option><option value="private">Privat</option></select><input type="number" min="0" name="min_price" defaultValue={typeof params.min_price === 'string' ? params.min_price : ''} className="min-h-11 rounded-xl border border-[#c8d0c5] px-3" placeholder="Harga min." /><input type="number" min="0" name="max_price" defaultValue={typeof params.max_price === 'string' ? params.max_price : ''} className="min-h-11 rounded-xl border border-[#c8d0c5] px-3" placeholder="Harga maks." /><select name="sort" defaultValue={typeof params.sort === 'string' ? params.sort : 'newest'} className="min-h-11 rounded-xl border border-[#c8d0c5] px-3"><option value="newest">Terbaru</option><option value="name_asc">Nama A–Z</option><option value="price_asc">Harga terendah</option><option value="price_desc">Harga tertinggi</option></select><button className="min-h-11 rounded-xl bg-[#17231f] px-4 font-bold text-white">Terapkan</button></form>
    {result.error === 'invalid_filter' && <p role="alert" className="mt-6 rounded-2xl bg-[#fff3ca] p-4 font-medium">Filter tidak valid. Periksa nilai lalu coba lagi.</p>}
    {result.error === 'api' && <p role="alert" className="mt-6 rounded-2xl bg-[#fde8e7] p-4 font-medium">Katalog belum dapat dimuat. Coba muat ulang beberapa saat lagi.</p>}
    {result.data && (result.data.items.length ? <><p className="mt-8 text-sm text-[#65726c]">{result.data.pagination.total_items} kelas tersedia</p><section className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Daftar kelas">{result.data.items.map(item => <CatalogCard item={item} key={item.id} />)}</section>{result.data.pagination.total_pages > 1 && <nav className="mt-10 flex justify-between" aria-label="Halaman katalog">{page > 1 ? <Link className="font-bold underline" href={pageLink(page - 1)}>← Sebelumnya</Link> : <span />}{page < result.data.pagination.total_pages && <Link className="font-bold underline" href={pageLink(page + 1)}>Berikutnya →</Link>}</nav>}</> : <section className="mt-8 rounded-3xl border border-dashed border-[#c8d0c5] bg-white p-10 text-center"><h2 className="text-2xl font-black">Belum ada kelas yang cocok.</h2><p className="mt-2 text-[#52615b]">Coba hapus atau ubah filter pencarian Anda.</p></section>)}</div></main>;
}
