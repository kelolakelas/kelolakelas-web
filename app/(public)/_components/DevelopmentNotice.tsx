import { ArrowUpRight, CircleAlert } from "lucide-react";

export function DevelopmentNotice() {
  return (
    <section className="px-5 py-20 sm:px-8 sm:py-24 lg:px-10" aria-labelledby="development-title">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 rounded-[2rem] bg-[#17231f] p-7 text-[#f8f7f3] sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:p-14">
        <div className="max-w-2xl"><div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-[#d9f25b]"><CircleAlert size={17} aria-hidden="true" /> Catatan pengembangan</div><h2 id="development-title" className="mt-5 text-3xl font-black leading-tight tracking-[-0.05em] sm:text-4xl">Kami sedang membangun ini bersama pengguna awal.</h2><p className="mt-4 max-w-xl leading-7 text-[#b9c7bc]">KelolaKelas masih dalam tahap &quot;Work in Progress&quot;. Beberapa fitur dan alur dapat berubah selama beta. Masukanmu akan membantu menentukan apa yang kami bangun berikutnya.</p></div>
        <a className="flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#d9f25b] px-6 font-bold text-[#17231f] transition-transform hover:-translate-y-0.5 lg:self-center" href="/register">Gabung pengguna awal <ArrowUpRight size={18} aria-hidden="true" /></a>
      </div>
    </section>
  );
}