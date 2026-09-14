import { ArrowRight, Construction, Sparkles } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20 lg:px-10 lg:pt-24" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute -right-24 top-8 size-64 rounded-full bg-[#d9f25b]/40 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto grid w-full max-w-7xl items-end gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] lg:gap-20">
        <div className="max-w-3xl">
          <div className="mb-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d7a12b]/40 bg-[#fff3ca] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#76520b]">
            <Construction size={16} aria-hidden="true" />
            🚧 Saat ini dalam pengembangan / Beta
          </div>
          <p className="mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#617c35]"><Sparkles size={16} aria-hidden="true" /> Ruang kerja pendidikan yang lebih tertata</p>
          <h1 id="hero-title" className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.065em] text-[#17231f] sm:text-7xl lg:text-[5.5rem]">
            Semua kelasmu, <span className="text-[#91a82d]">satu kendali.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#52615b] sm:text-xl">
            KelolaKelas menyatukan tenant, anggota, peran, kelas, dan jadwal agar tim pendidikan bisa fokus pada hal yang paling penting: proses belajar.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#17231f] px-6 font-bold text-[#f8f7f3] shadow-[0_8px_0_#b8c746] transition-transform hover:-translate-y-0.5" href="/kelas">
              Jelajahi kelas <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#17231f] px-6 font-bold text-[#f8f7f3] shadow-[0_8px_0_#b8c746] transition-transform hover:-translate-y-0.5" href="/register">
              Daftar untuk akses awal <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="flex min-h-12 items-center justify-center rounded-full border border-[#c8d0c5] px-6 font-bold text-[#17231f] transition-colors hover:bg-white" href="#fitur">
              Lihat kemampuan utama
            </a>
          </div>
        </div>
        <div className="relative min-h-72 overflow-hidden rounded-[2rem] border border-[#dfe3d7] bg-[#e9eddf] p-5 shadow-[12px_12px_0_#d9f25b] sm:min-h-80 sm:p-7" aria-label="Pratinjau ruang kerja KelolaKelas">
          <div className="flex items-center justify-between border-b border-[#cbd5c1] pb-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#71806b]">Ringkasan hari ini</p><p className="mt-1 text-2xl font-black tracking-[-0.04em]">Ruang kerja aktif</p></div>
            <span className="size-3 rounded-full bg-[#a9c43d] shadow-[0_0_0_5px_#d9f25b]" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-5">
            <div className="rounded-2xl bg-white p-4"><p className="text-xs text-[#71806b]">Kelas aktif</p><p className="mt-2 text-3xl font-black">24</p></div>
            <div className="rounded-2xl bg-[#17231f] p-4 text-[#f8f7f3]"><p className="text-xs text-[#b9c7bc]">Anggota</p><p className="mt-2 text-3xl font-black">186</p></div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-white p-4"><span className="text-sm font-semibold">Jadwal berikutnya</span><span className="rounded-full bg-[#fff3ca] px-3 py-1 text-xs font-bold text-[#76520b]">09.00 WIB</span></div>
        </div>
      </div>
    </section>
  );
}
