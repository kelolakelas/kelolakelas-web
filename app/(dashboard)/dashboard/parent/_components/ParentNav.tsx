'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PARENT_NAV_ITEMS } from '../_lib/nav';

function isActive(current: string, href: string): boolean {
  if (current === href) return true;
  if (href === '/dashboard/parent/enrollments') return false;
  return current.startsWith(`${href}/`);
}

/**
 * Shared parent navigation links (KEL-141), desktop row + mobile grid.
 * Client-side only so the current route can be marked with aria-current.
 */
export function ParentNavLinks() {
  const current = usePathname() ?? '';
  return (
    <>
      <nav aria-label="Navigasi parent" className="hidden gap-1 md:flex">
        {PARENT_NAV_ITEMS.map((item) => {
          const active = isActive(current, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                active ? 'bg-[#17231f] text-white' : 'text-[#365047] hover:bg-[#eef4e8]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Navigasi parent" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:hidden">
        {PARENT_NAV_ITEMS.map((item) => {
          const active = isActive(current, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`min-h-11 rounded-xl border px-3 py-2.5 text-center text-sm font-bold ${
                active
                  ? 'border-[#17231f] bg-[#17231f] text-white'
                  : 'border-[#dfe3d7] bg-white text-[#365047]'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
