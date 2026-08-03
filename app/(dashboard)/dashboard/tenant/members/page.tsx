import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaginationControls } from '../_components/PaginationControls';
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
async function MembersContent({ page, search }: { page: number; search?: string }) {
  const [membersResult, rolesResult, permissionsResult] = await Promise.all([
    getTenantMembers({ page, search }),
    getTenantRoles({ page, search }),
    getSystemPermissions({ page }),
  ]);
  const errors = [membersResult, rolesResult, permissionsResult]
    .map((result) => result.error)
    .filter(Boolean);

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
          <form method="get" className="mt-3 flex gap-2">
            <input name="search" defaultValue={search} placeholder="Cari anggota" className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" />
            <button type="submit" className="min-h-11 rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white">Cari</button>
          </form>
        </div>

        <InviteMemberModal roles={rolesResult.data} permissions={permissionsResult.data} />
      </div>

      {errors.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errors[0]}
        </div>
      )}

      {/* Members Table & Mobile Card View */}
      <MembersTable members={membersResult.data} roles={rolesResult.data} />
      <PaginationControls pagination={membersResult.pagination} basePath="/dashboard/tenant/members" />
    </div>
  );
}

export default async function TenantMembersPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<MembersSkeleton />}>
        <MembersContent page={page} search={params.search} />
      </Suspense>
    </main>
  );
}
