import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaginationControls } from '../_components/PaginationControls';
import { RoleCreationForm } from './_components/RoleCreationForm';
import { RoleListTable } from './_components/RoleListTable';
import { RolesSkeleton } from './_components/RolesSkeleton';
import { getAvailablePermissions, getTenantRoles } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Roles & Permissions - Tenant Dashboard',
  description: 'Manage custom roles and permission policies for tenant organization members.',
  alternates: {
    canonical: '/dashboard/tenant/roles',
  },
};

/**
 * Async Server Component that fetches roles and permissions in parallel.
 */
async function RolesContent({ page, search }: { page: number; search?: string }) {
  const [permissionsResult, rolesResult] = await Promise.all([
    getAvailablePermissions({ page }),
    getTenantRoles({ page, search }),
  ]);

  return (
    <div className="space-y-8">
      {/* Role Creation Form Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Create Custom Role
          </h2>
        </div>
        <RoleCreationForm availablePermissions={permissionsResult.data} />
      </section>

      {/* Existing Roles List Section */}
      <section className="pt-4 border-t border-gray-200 dark:border-gray-800">
        <RoleListTable roles={rolesResult.data} />
        <PaginationControls pagination={rolesResult.pagination} basePath="/dashboard/tenant/roles" />
      </section>
    </div>
  );
}

export default async function TenantRolesPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="pb-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Roles &amp; Permission Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Define fine-grained custom roles and access policies for your organization team members.
          </p>
          <form method="get" className="mt-3 flex gap-2">
            <input name="search" placeholder="Cari role" className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" />
            <button type="submit" className="min-h-11 rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white">Cari</button>
          </form>
        </div>
      </div>

      {/* Partial Prerendering Boundary */}
      <Suspense fallback={<RolesSkeleton />}>
        <RolesContent page={page} search={params.search} />
      </Suspense>
    </div>
  );
}
