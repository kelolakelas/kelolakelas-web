'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-5xl rounded-3xl border border-[#f2c6c3] bg-white p-8" role="alert">
        <p className="text-sm font-bold uppercase tracking-[.14em] text-[#b42318]">Terjadi kesalahan</p>
        <h1 className="mt-2 text-3xl font-black">Profil student belum dapat dimuat.</h1>
        <p className="mt-3 text-[#52615b]">Coba muat ulang halaman. Jika masalah berlanjut, layanan akademik mungkin sedang tidak tersedia.</p>
        <button type="button" onClick={reset} className="mt-5 min-h-11 rounded-xl bg-[#17231f] px-5 font-bold text-white">Coba lagi</button>
      </section>
    </main>
  );
}
