import type { Metadata } from "next";
import Link from "next/link";
import { DevelopmentNotice } from "./_components/DevelopmentNotice";
import { EarlyAccessModal } from "./_components/EarlyAccessModal";
import { FeaturesSection } from "./_components/FeaturesSection";
import { HeroSection } from "./_components/HeroSection";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://kelolakelas.id";
const PAGE_TITLE = "KelolaKelas - Manajemen Kelas & Tenant Modern";
const PAGE_DESCRIPTION =
  "KelolaKelas membantu lembaga pendidikan mengatur tenant, anggota, peran, kelas, dan jadwal dalam satu ruang kerja yang rapi.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: APP_URL,
    siteName: "KelolaKelas",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

const SOFTWARE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "KelolaKelas",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: APP_URL,
  description: PAGE_DESCRIPTION,
  softwareVersion: "Beta",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "IDR" },
  featureList: [
    "Manajemen tenant dan anggota",
    "Peran dan izin yang granular",
    "Pembuatan kelas dan jadwal",
  ],
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8f7f3] text-[#17231f]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex min-h-11 items-center gap-2" aria-label="KelolaKelas beranda">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#d9f25b] text-sm font-black text-[#17231f]">K</span>
          <span className="text-lg font-bold tracking-[-0.03em]">KelolaKelas</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold" aria-label="Navigasi utama">
          <a className="hidden min-h-11 items-center px-3 text-[#52615b] transition-colors hover:text-[#17231f] sm:flex" href="#fitur">
            Fitur
          </a>
          <EarlyAccessModal />
        </nav>
      </header>

      <main>
        <HeroSection />
        <FeaturesSection />
        <DevelopmentNotice />
      </main>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-3 border-t border-[#dfe3d7] px-5 py-8 text-sm text-[#65726c] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <p>© 2026 KelolaKelas. Dibangun untuk pengelolaan yang lebih tenang.</p>
        <p className="font-medium">Beta terbuka terbatas</p>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_SCHEMA) }} />
    </div>
  );
}
