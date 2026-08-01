import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InviteMemberModal } from './_components/InviteMemberModal';
import { MembersSkeleton } from './_components/MembersSkeleton';
import { MembersTable } from './_components/MembersTable';
import { getSystemPermissions, getTenantMembers, getTenantRoles } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Member Management - Tenant Dashboard',
  description:
    'Manage active tenant organization members, assign custom roles, and issue new invitations.',
  alternates: {
    canonical: '/dashboard/tenant/members',
  },
};

/**
 * Async content component wrapped in Suspense boundary for Partial Prerendering (PPR).
 */
async function MembersContent() {
  const [members, roles, permissions] = await Promise.all([
    getTenantMembers(),
    getTenantRoles(),
    getSystemPermissions(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Tenant Member Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View active team members, configure role permissions, and issue email invitations.
          </p>
        </div>

        <InviteMemberModal roles={roles} permissions={permissions} />
      </div>

      {/* Members Table & Mobile Card View */}
      <MembersTable members={members} roles={roles} />
    </div>
  );
}

export default function TenantMembersPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<MembersSkeleton />}>
        <MembersContent />
      </Suspense>
    </main>
  );
}
