import type { Metadata } from 'next';
import { SettingsForm } from './_components/SettingsForm';
import { getTenantSettings } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Settings - Tenant Dashboard',
  description: 'Manage tenant organization preferences and configuration settings.',
  alternates: {
    canonical: '/dashboard/tenant/settings',
  },
};

export default async function TenantSettingsPage() {
  const result = await getTenantSettings();

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Pengaturan organisasi
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Kelola informasi organisasi yang digunakan di seluruh platform.
        </p>
      </div>

      {result.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.error}</div>}
      {result.data ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
          <SettingsForm settings={result.data} />
        </div>
      ) : !result.error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Data pengaturan belum tersedia.</div>
      ) : null}
    </div>
  );
}
