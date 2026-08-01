import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings - Tenant Dashboard',
  description: 'Manage tenant organization preferences and configuration settings.',
  alternates: {
    canonical: '/dashboard/tenant/settings',
  },
};

export default function TenantSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Organization Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure organization profile, security, and integration preferences.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Tenant Configuration
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Tenant organization profile parameters can be managed here.
        </p>
      </div>
    </div>
  );
}
