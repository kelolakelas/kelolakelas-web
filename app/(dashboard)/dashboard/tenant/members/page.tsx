import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { InviteMemberModal } from './_components/InviteMemberModal';
import { MembersSkeleton } from './_components/MembersSkeleton';
import { MembersTable } from './_components/MembersTable';
import { PendingInvitations, PendingInvitationsSkeleton } from './_components/PendingInvitations';
import {
  getSystemPermissions,
  getTenantInvitations,
  getTenantMembers,
  getTenantRoles,
  type TenantInvitationsRead,
} from './_queries/queries';
import type { Role } from './_schemas/schema';
import { memberPageHref, parseMemberPage } from './_lib/schema';

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
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function MembersContent({ searchParams }: Props) {
  const params = await searchParams;
  const requestedPage = parseMemberPage(params);
  // Started before the members read and awaited inside its own Suspense
  // boundary, so a slow, forbidden or failed invitation read never delays or
  // breaks the members table (KEL-84).
  const invitationsRead = getTenantInvitations();
  const [initialMembersRead, roles, permissions] = await Promise.all([
    getTenantMembers(requestedPage),
    getTenantRoles(),
    getSystemPermissions(),
  ]);
  const page =
    initialMembersRead.pagination.total_pages > 0 &&
    requestedPage > initialMembersRead.pagination.total_pages
      ? 1
      : requestedPage;
  const membersRead = page === requestedPage
    ? initialMembersRead
    : await getTenantMembers(page);

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
      <MembersTable members={membersRead.members} roles={roles} />

      {membersRead.pagination.total_pages > 1 && (
        <nav
          className="flex items-center justify-between pt-2"
          aria-label="Halaman anggota"
        >
          {page > 1 ? (
            <Link
              href={memberPageHref(page - 1)}
              className="inline-flex min-h-[44px] items-center text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
            >
              ← Sebelumnya
            </Link>
          ) : (
            <span />
          )}

          <span className="text-xs text-gray-500 dark:text-gray-400">
            Halaman {page} dari {membersRead.pagination.total_pages}
          </span>

          {page < membersRead.pagination.total_pages ? (
            <Link
              href={memberPageHref(page + 1)}
              className="inline-flex min-h-[44px] items-center text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
            >
              Berikutnya →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      <Suspense fallback={<PendingInvitationsSkeleton />}>
        <PendingInvitationsContent read={invitationsRead} roles={roles} />
      </Suspense>
    </div>
  );
}

async function PendingInvitationsContent({
  read,
  roles,
}: {
  read: Promise<TenantInvitationsRead>;
  roles: Role[];
}) {
  return <PendingInvitations read={await read} roles={roles} />;
}

export default function TenantMembersPage({ searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<MembersSkeleton />}>
        <MembersContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
