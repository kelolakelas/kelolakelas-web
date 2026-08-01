"use client";

import { ArrowUpRight, Clock3, X } from "lucide-react";
import { useEffect, useState } from "react";

export function EarlyAccessModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="flex min-h-11 items-center gap-1 rounded-full bg-[#17231f] px-4 text-[#f8f7f3] transition-transform hover:-translate-y-0.5"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        Akses awal <ArrowUpRight size={16} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17231f]/70 px-5 py-8 backdrop-blur-sm"
          role="presentation"
          onClick={() => setIsOpen(false)}
        >
          <section
            className="relative w-full max-w-md rounded-[2rem] bg-[#f8f7f3] p-7 text-[#17231f] shadow-2xl sm:p-9"
            role="dialog"
            aria-modal="true"
            aria-labelledby="early-access-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full text-[#65726c] transition-colors hover:bg-[#e9eddf] hover:text-[#17231f]"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup modal"
            >
              <X size={20} aria-hidden="true" />
            </button>
            <div className="flex size-12 items-center justify-center rounded-2xl bg-[#d9f25b]"><Clock3 size={24} aria-hidden="true" /></div>
            <p className="mt-7 text-sm font-bold uppercase tracking-[0.14em] text-[#617c35]">Coming soon</p>
            <h2 id="early-access-title" className="mt-3 text-3xl font-black tracking-[-0.05em]">Akses awal segera hadir.</h2>
            <p className="mt-4 leading-7 text-[#65726c]">Kami sedang menyiapkan pengalaman terbaik untuk pengguna awal KelolaKelas. Nantikan kabar peluncurannya.</p>
            <button
              type="button"
              className="mt-7 flex min-h-12 w-full items-center justify-center rounded-full bg-[#17231f] px-5 font-bold text-[#f8f7f3] transition-colors hover:bg-[#33453d]"
              onClick={() => setIsOpen(false)}
            >
              Mengerti
            </button>
          </section>
        </div>
      )}
    </>
  );
}