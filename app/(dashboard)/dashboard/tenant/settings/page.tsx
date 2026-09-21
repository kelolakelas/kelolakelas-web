import type { Metadata } from 'next';
import { TenantLocationForm } from './_components/TenantLocationForm';
import { TenantProfileForm } from './_components/TenantProfileForm';
import { getTenantSettings } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Pengaturan Tenant - Tenant Dashboard',
  description:
    'Perbarui profil dan lokasi tenant agar kelas tampil pada katalog publik dengan alamat yang benar.',
  alternates: {
    canonical: '/dashboard/tenant/settings',
  },
};

/**
 * Error panel for the states that stop the forms from rendering at all.
 *
 * `forbidden` is presented as a permission state rather than as a failure: the
 * identity service guards both settings update routes with `tenant:update`, so
 * a member without it is expected here and must be told what to ask for instead
 * of being shown a technical error.
 */
function SettingsErrorPanel({
  error,
  message,
}: {
  error: 'forbidden' | 'api' | 'configuration';
  message: string;
}) {
  const isForbidden = error === 'forbidden';

  return (
    <section
      role="alert"
      className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-6 sm:p-8"
    >
      <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-700 dark:text-amber-400">
        {isForbidden ? 'Akses ditolak' : 'Pengaturan tidak tersedia'}
      </p>
      <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        {isForbidden
          ? 'Anda tidak memiliki akses ke pengaturan tenant.'
          : 'Pengaturan tenant belum dapat dimuat.'}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300">{message}</p>
    </section>
  );
}

/**
 * Tenant settings screen.
 *
 * Two independent forms over two identity endpoints: the profile
 * (`GET`/`PATCH /api/v1/tenant/settings`) and the location
 * (`GET`/`PUT /api/v1/tenant/settings/location`). Both updates require the
 * `tenant:update` permission, which the backend enforces per request; the
 * read refused case is rendered as a permission panel because a tenant whose
 * settings cannot be read cannot be given a meaningful editable form either.
 *
 * The forms are keyed on the stored values so a successful save re-mounts them
 * from the persisted state, which is what makes the backend's geocoded address
 * appear after submitting an address without coordinates.
 */
export default async function TenantSettingsPage() {
  const result = await getTenantSettings();

  if (result.error) {
    return (
      <div className="space-y-6">
        <header className="pb-4 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Pengaturan Tenant
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola profil dan lokasi tenant yang tampil pada katalog publik.
          </p>
        </header>

        <SettingsErrorPanel error={result.error} message={result.message} />
      </div>
    );
  }

  const { profile, location } = result;

  return (
    <div className="space-y-6">
      <header className="pb-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Pengaturan Tenant
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Kelola profil dan lokasi tenant yang tampil pada katalog publik.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Profil tenant
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Nama, telepon, alamat profil, dan deskripsi yang dilihat calon pembeli.
          </p>
        </div>
        <TenantProfileForm key={profile.id} profile={profile} readOnly={false} />
      </section>

      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Lokasi tenant
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Lokasi menentukan apakah kelas tenant muncul pada pencarian katalog berbasis
            radius.
          </p>
        </div>
        <TenantLocationForm
          key={`${profile.id}-${location?.location_updated_at ?? 'unset'}`}
          location={location}
          readOnly={false}
        />
      </section>
    </div>
  );
}

