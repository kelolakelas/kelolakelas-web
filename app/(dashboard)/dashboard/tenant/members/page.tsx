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
const MEMBER_SORT_OPTIONS = ['joined_at', 'updated_at', 'email', 'name'] as const;
type MemberSort = (typeof MEMBER_SORT_OPTIONS)[number];

interface MemberListParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  role_id?: string;
  sort: MemberSort;
  order: 'asc' | 'desc';
}

async function MembersContent({ params }: { params: MemberListParams }) {
  const [membersResult, rolesResult, permissionsResult] = await Promise.all([
    getTenantMembers(params),
    getTenantRoles({ page: params.page, search: params.search }),
    getSystemPermissions({ page: params.page }),
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
          <form method="get" className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input name="search" defaultValue={params.search} placeholder="Cari anggota" className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" />
            <select name="status" defaultValue={params.status || ''} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" aria-label="Filter status">
              <option value="">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak aktif</option>
            </select>
            <select name="role_id" defaultValue={params.role_id || ''} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" aria-label="Filter role">
              <option value="">Semua role</option>
              {rolesResult.data.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <select name="page_size" defaultValue={String(params.pageSize)} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" aria-label="Jumlah member per halaman">
              <option value="10">10 per halaman</option>
              <option value="20">20 per halaman</option>
              <option value="50">50 per halaman</option>
            </select>
            <select name="sort" defaultValue={params.sort} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" aria-label="Urutkan member berdasarkan">
              <option value="joined_at">Tanggal bergabung</option>
              <option value="updated_at">Terakhir diperbarui</option>
              <option value="email">Email</option>
              <option value="name">Nama</option>
            </select>
            <select name="order" defaultValue={params.order} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" aria-label="Urutan member">
              <option value="desc">Terbaru ke terlama</option>
              <option value="asc">Terlama ke terbaru</option>
            </select>
            <input type="hidden" name="page" value="1" />
            <button type="submit" className="min-h-11 rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white">Terapkan filter</button>
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
      <MembersTable members={membersResult.data} />
      <PaginationControls
        pagination={membersResult.pagination}
        basePath="/dashboard/tenant/members"
        query={{
          page_size: String(params.pageSize),
          search: params.search,
          status: params.status,
          role_id: params.role_id,
          sort: params.sort,
          order: params.order,
        }}
      />
    </div>
  );
}

export default async function TenantMembersPage({ searchParams }: { searchParams: Promise<{ page?: string; page_size?: string; search?: string; status?: string; role_id?: string; sort?: string; order?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSizeValue = Number(params.page_size);
  const pageSize = [10, 20, 50].includes(pageSizeValue) ? pageSizeValue : 20;
  const order = params.order === 'asc' ? 'asc' : 'desc';
  const sort = MEMBER_SORT_OPTIONS.includes(params.sort as MemberSort) ? (params.sort as MemberSort) : 'joined_at';
  const memberParams: MemberListParams = {
    page,
    pageSize,
    search: params.search?.trim() || undefined,
    status: params.status === 'active' || params.status === 'inactive' ? params.status : undefined,
    role_id: params.role_id || undefined,
    sort,
    order,
  };
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<MembersSkeleton />}>
        <MembersContent params={memberParams} />
      </Suspense>
    </main>
  );
}
