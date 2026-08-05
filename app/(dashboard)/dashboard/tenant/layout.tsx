import { getAuthCookieName } from '@/lib/api/client';
import { decodeTokenClaims, getDashboardRole } from '@/lib/auth/token';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { MobileNav } from './_components/MobileNav';
import { TenantSidebar, type SidebarProfile } from './_components/TenantSidebar';
import { getTenantMembers } from './members/_queries/queries';
import { getTenantSettings } from './settings/_queries/queries';

export const dynamic = 'force-dynamic';

interface TenantLayoutProps {
  children: ReactNode;
}

async function getSidebarProfile(): Promise<SidebarProfile> {
  const token = (await cookies()).get(getAuthCookieName())?.value;
  const claims = token ? decodeTokenClaims(token) : {};
  const [tenantResult, membersResult] = await Promise.all([
    getTenantSettings(),
    getTenantMembers({ pageSize: 100 }),
  ]);
  const currentMember = membersResult.data.find(
    (member) => member.user_id === claims.user_id || member.id === claims.sub
  );
  const fullName = [currentMember?.first_name, currentMember?.last_name].filter(Boolean).join(' ');

  return {
    tenantName: tenantResult.data?.name || 'Tenant',
    userName: fullName || currentMember?.email || claims.sub || 'Pengguna',
    roleName: currentMember?.role?.name || claims.role || 'Tenant Member',
  };
}

export default async function TenantLayout({ children }: TenantLayoutProps) {
  const token = (await cookies()).get(getAuthCookieName())?.value;
  if (!token) redirect('/login?redirectTo=/dashboard/tenant');
  try {
    if (getDashboardRole(decodeTokenClaims(token)) !== 'tenant') redirect('/dashboard/parent');
  } catch {
    redirect('/login?redirectTo=/dashboard/tenant');
  }
  const sidebarProfile = await getSidebarProfile();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile Sticky Navigation Topbar */}
      <MobileNav profile={sidebarProfile} />

      {/* Desktop Fixed Sidebar */}
      <TenantSidebar profile={sidebarProfile} />

      {/* Main Content Area */}
      <div className="md:pl-64 flex flex-col min-h-screen transition-all">
        <main className="flex-1 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
