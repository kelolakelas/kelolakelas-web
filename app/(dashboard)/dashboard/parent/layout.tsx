import type { ReactNode } from 'react';
import Link from 'next/link';
import { ParentNavLinks } from './_components/ParentNav';

/**
 * Shared parent dashboard shell (KEL-141): brand header plus the four-area
 * nav on desktop and mobile. Child pages keep their own `<main>` landmark;
 * this layout renders a plain wrapper so landmarks are never nested.
 */
export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="border-b border-[#dfe3d7] bg-white/80">
        <div className="mx-auto max-w-6xl px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/kelas" className="text-lg font-black tracking-tight text-[#17231f]">
              KelolaKelas <span className="font-bold text-[#617c35]">Parent</span>
            </Link>
            <ParentNavLinks />
          </div>
        </div>
      </div>
      {children}
    </>
  );
}
