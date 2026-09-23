import Link from 'next/link';

/**
 * Branded 404 for unmatched URLs and for every `notFound()` call that has no closer
 * `not-found.tsx` (KEL-48). Next.js renders it inside the root layout and adds
 * `<meta name="robots" content="noindex">` itself.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#f8f7f3] px-5 py-16 text-[#17231f] sm:px-8">
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-[#dfe3d7] bg-white p-8 text-center sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-[#617c35]">404 · KelolaKelas</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-.055em]">Halaman tidak ditemukan.</h1>
        <p className="mt-4 text-[#52615b]">Alamat yang Anda buka tidak tersedia atau sudah dipindahkan. Periksa kembali tautannya, atau lanjutkan dari katalog kelas.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/kelas" className="inline-block rounded-xl bg-[#617c35] px-5 py-3 font-bold text-white">Lihat katalog</Link>
          <Link href="/" className="inline-block rounded-xl border border-[#dfe3d7] px-5 py-3 font-bold text-[#617c35] hover:bg-[#eef4e8]">Kembali ke beranda</Link>
        </div>
      </section>
    </main>
  );
}
