import Link from 'next/link';
import {
  countActiveInvitations,
  getTenantInvitations,
  getTenantMembers,
  getTenantRoles,
} from '../members/_queries/queries';

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  href: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

function MetricCard({ title, value, description, href, iconBg, iconColor, icon }: MetricCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/90 p-5 shadow-xs transition-all hover:border-blue-500/50 hover:shadow-md dark:hover:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {title}
        </span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3">
        <div className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          {value}
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
        <span>Manage {title.toLowerCase()}</span>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

export async function OverviewMetrics() {
  // Gracefully fetch metrics from server queries
  const [membersRead, roles, invitationsRead] = await Promise.all([
    getTenantMembers(),
    getTenantRoles(),
    getTenantInvitations(),
  ]);

  const totalMembers = membersRead.pagination.total_items;
  // KEL-84: pending invitations come from the invitation list, counting only
  // unexpired ones. A forbidden or failed read shows "—" rather than a
  // misleading 0.
  const pendingInvitations =
    invitationsRead.state === 'ok' ? countActiveInvitations(invitationsRead.invitations) : '—';
  const activeRoles = roles.length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Members"
        value={totalMembers}
        description="Active team members in tenant"
        href="/dashboard/tenant/members"
        iconBg="bg-blue-50 dark:bg-blue-950/60"
        iconColor="text-blue-600 dark:text-blue-400"
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        }
      />

      <MetricCard
        title="Active Roles"
        value={activeRoles}
        description="Configured tenant roles"
        href="/dashboard/tenant/roles"
        iconBg="bg-purple-50 dark:bg-purple-950/60"
        iconColor="text-purple-600 dark:text-purple-400"
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        }
      />

      <MetricCard
        title="Pending Invites"
        value={pendingInvitations}
        description="Invitations awaiting response"
        href="/dashboard/tenant/members"
        iconBg="bg-amber-50 dark:bg-amber-950/60"
        iconColor="text-amber-600 dark:text-amber-400"
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        }
      />

      <MetricCard
        title="System Status"
        value="Operational"
        description="Identity & Academic Services online"
        href="/dashboard/tenant/settings"
        iconBg="bg-emerald-50 dark:bg-emerald-950/60"
        iconColor="text-emerald-600 dark:text-emerald-400"
        icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        }
      />
    </div>
  );
}
