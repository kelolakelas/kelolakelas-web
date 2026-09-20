'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogoutButton } from '@/app/(auth)/logout/_components/LogoutButton';
import { TENANT_NAV_ITEMS } from '../_constants/constants';

function NavIcon({ href }: { href: string }) {
  if (href === '/dashboard/tenant') {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    );
  }

  if (href === '/dashboard/tenant/members') {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  // Remount the stateful drawer when the route changes so navigation always
  // closes it without synchronously updating state from an effect.
  return <MobileNavContent key={pathname} pathname={pathname} />;
}

function MobileNavContent({ pathname }: { pathname: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 md:hidden">
      {/* Brand Logo & Name */}
      <Link href="/dashboard/tenant" className="flex items-center gap-2.5 min-h-[44px] min-w-[44px]">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-base shadow-xs">
          T
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Tutorin
          </span>
          <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Tenant Portal
          </span>
        </div>
      </Link>

      {/* Hamburger Menu Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Toggle navigation menu"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Slide-out Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative flex w-4/5 max-w-xs flex-col bg-white dark:bg-gray-900 shadow-2xl z-10 border-r border-gray-200 dark:border-gray-800">
            <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Navigation</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
              {TENANT_NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === '/dashboard/tenant'
                    ? pathname === '/dashboard/tenant'
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-[44px] items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <NavIcon href={item.href} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold text-xs">
                  TN
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                    Tenant Admin
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    Organization Owner
                  </span>
                </div>
              </div>
              <div className="mt-2">
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
