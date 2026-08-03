import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { OverviewMetrics } from './_components/OverviewMetrics';
import { OverviewMetricsSkeleton } from './_components/OverviewSkeleton';

export const metadata: Metadata = {
  title: 'Overview - Tenant Dashboard',
  description:
    'Tenant organization portal overview, system metrics, active members, and quick administration actions.',
  alternates: {
    canonical: '/dashboard/tenant',
  },
};

export default function TenantOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            Welcome back, Tenant Admin
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Here is what is happening across your organization today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/tenant/members"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Invite Member</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards wrapped in Suspense for PPR */}
      <Suspense fallback={<OverviewMetricsSkeleton />}>
        <OverviewMetrics />
      </Suspense>

      {/* Quick Action & System Shortcuts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Management Actions */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Organization Management
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Quickly navigate to common administrative workflows for your tenant organization.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Link
              href="/dashboard/tenant/members"
              className="flex min-h-[44px] items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 transition-colors hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Member Directory
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    View & invite team members
                  </div>
                </div>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/dashboard/tenant/settings"
              className="flex min-h-[44px] items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 transition-colors hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Tenant Settings
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Organization details & API keys
                  </div>
                </div>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* System Status Panel */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Platform Architecture
          </h2>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <span className="font-medium text-gray-700 dark:text-gray-300">Identity Service</span>
              <span className="font-semibold text-gray-500 dark:text-gray-400">
                Not checked
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <span className="font-medium text-gray-700 dark:text-gray-300">Academic Service</span>
              <span className="font-semibold text-gray-500 dark:text-gray-400">
                Not checked
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <span className="font-medium text-gray-700 dark:text-gray-300">Next.js PPR Engine</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                Enabled
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
