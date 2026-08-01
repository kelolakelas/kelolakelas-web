import type { ReactNode } from 'react';
import { MobileNav } from './_components/MobileNav';
import { TenantSidebar } from './_components/TenantSidebar';

export const dynamic = 'force-dynamic';

interface TenantLayoutProps {
  children: ReactNode;
}

export default function TenantLayout({ children }: TenantLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile Sticky Navigation Topbar */}
      <MobileNav />

      {/* Desktop Fixed Sidebar */}
      <TenantSidebar />

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col min-h-screen transition-all">
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
