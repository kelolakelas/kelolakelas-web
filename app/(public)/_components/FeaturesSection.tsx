import type { LucideIcon } from "lucide-react";
import { CalendarClock, ShieldCheck, UsersRound } from "lucide-react";

const FEATURES: ReadonlyArray<{ icon: LucideIcon; title: string; description: string; accent: string }> = [
  { icon: UsersRound, title: "Tenant & anggota", description: "Atur organisasi dan seluruh anggotanya dari satu ruang kerja yang jelas.", accent: "bg-[#d9f25b]" },
  { icon: ShieldCheck, title: "Peran & izin granular", description: "Tentukan siapa dapat melihat, mengelola, dan mengubah bagian tertentu.", accent: "bg-[#f3d18b]" },
  { icon: CalendarClock, title: "Kelas & jadwal seamless", description: "Buat kelas, susun jadwal, dan jaga ritme operasional tetap terkoordinasi.", accent: "bg-[#bcd9cf]" },
];

export function FeaturesSection() {
  return (
    <section id="fitur" className="border-y border-[#dfe3d7] bg-white px-5 py-20 sm:px-8 sm:py-24 lg:px-10" aria-labelledby="features-title">
      <div className="mx-auto w-full max-w-7xl">
        <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.18em] text-[#617c35]">Dirancang untuk tim yang bergerak</p><h2 id="features-title" className="mt-4 text-4xl font-black leading-tight tracking-[-0.055em] sm:text-5xl">Lebih sedikit tab. Lebih banyak kendali.</h2></div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description, accent }) => (
            <article key={title} className="rounded-3xl border border-[#dfe3d7] p-6 transition-transform hover:-translate-y-1 sm:p-7">
              <div className={`flex size-12 items-center justify-center rounded-2xl ${accent}`}><Icon size={24} aria-hidden="true" /></div>
              <h3 className="mt-8 text-2xl font-black tracking-[-0.04em]">{title}</h3>
              <p className="mt-3 leading-7 text-[#65726c]">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}