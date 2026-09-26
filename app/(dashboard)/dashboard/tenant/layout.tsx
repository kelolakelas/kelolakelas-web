import type { ReactNode } from 'react';
import Link from 'next/link';
import { readCreatorRequests } from '@/lib/creator-requests';
import { MobileNav } from './_components/MobileNav';
import { TenantSidebar } from './_components/TenantSidebar';

export const dynamic = 'force-dynamic';

interface TenantLayoutProps {
  children: ReactNode;
}

export default async function TenantLayout({ children }: TenantLayoutProps) {
  const creator = (await readCreatorRequests(false)).status === 200;
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile Sticky Navigation Topbar */}
      <MobileNav />

      {/* Desktop Fixed Sidebar */}
      <TenantSidebar />

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col min-h-screen transition-all">
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {creator && <Link href="/dashboard/tenant/creator-requests" className="mb-4 inline-block rounded bg-blue-600 px-4 py-3 text-white">Creator requests</Link>}
          {children}
        </main>
      </div>
    </div>
  );
}
