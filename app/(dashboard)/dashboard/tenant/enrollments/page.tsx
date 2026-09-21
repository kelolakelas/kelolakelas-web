import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  EMPTY_ENROLLMENT_FILTERS,
  enrollmentCountLabel,
  enrollmentPageHref,
  parseEnrollmentFilters,
  type EnrollmentFilters,
} from './_lib/schema';
import { EnrollmentStatusFilter } from './_components/EnrollmentStatusFilter';
import { EnrollmentTable } from './_components/EnrollmentTable';
import { EnrollmentsSkeleton } from './_components/EnrollmentsSkeleton';
import { getTenantEnrollments } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Enrollment & Pembayaran - Tenant Dashboard',
  description:
    'Pantau enrollment student pada kelas tenant beserta status pembayaran dan status rekonsiliasinya.',
  alternates: {
    canonical: '/dashboard/tenant/enrollments',
  },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Error panel for the states that stop the list from rendering at all.
 *
 * `forbidden` is presented as a permission state, not as a failure: the academic
 * service guards this endpoint with `enrollment:read`, so a member without that
 * permission is expected here and must not be shown a technical error. Every
 * other state is a genuine problem with the gateway or the backend.
 */
function EnrollmentErrorPanel({
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
        {isForbidden ? 'Akses ditolak' : 'Enrollment tidak tersedia'}
      </p>
      <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        {isForbidden
          ? 'Anda tidak memiliki akses ke daftar enrollment.'
          : 'Daftar enrollment belum dapat dimuat.'}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300">{message}</p>
      {!isForbidden && (
        <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
          Muat ulang halaman ini beberapa saat lagi.
        </p>
      )}
    </section>
  );
}

/**
 * Enrollment and payment overview for the active tenant (KEL-33).
 *
 * The page is a Server Component so the gateway reads happen with the session
 * cookies and the tenant is derived from the JWT claim server-side. Nothing on
 * this page filters by tenant in the browser: the academic and billing services
 * scope every row themselves, and the only filter this screen can change is the
 * enrollment status the backend has already validated.
 */
async function EnrollmentsContent({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = parseEnrollmentFilters(params);
  const filters: EnrollmentFilters = parsed.filters ?? EMPTY_ENROLLMENT_FILTERS;
  const result = await getTenantEnrollments(params);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Enrollment &amp; Pembayaran
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Pantau student yang terdaftar pada kelas tenant Anda, lengkap dengan status
            enrollment dan status pembayarannya.
          </p>
        </div>
      </div>

      {parsed.error === 'invalid_filter' && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm font-medium text-amber-900 dark:text-amber-200"
        >
          Filter tidak valid. Status enrollment hanya menerima pending, active, completed, atau
          dropped, dan halaman harus berupa angka positif.
        </p>
      )}

      <EnrollmentStatusFilter
        status={parsed.error === 'invalid_filter' ? '' : filters.status}
        disabled={result.error === 'forbidden'}
      />

      {result.error === 'invalid_filter' ? null : result.error ? (
        <EnrollmentErrorPanel error={result.error} message={result.message} />
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {enrollmentCountLabel(result.data.pagination)}
            {filters.status !== '' &&
              ` · filter status ${filters.status}`}
          </p>

          <EnrollmentTable rows={result.data.rows} isFiltered={filters.status !== ''} />

          {result.data.pagination.total_pages > 1 && (
            <nav
              className="flex items-center justify-between pt-2"
              aria-label="Halaman enrollment"
            >
              {filters.page > 1 ? (
                <Link
                  href={enrollmentPageHref(filters.page - 1, filters)}
                  className="inline-flex min-h-[44px] items-center text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
                >
                  ← Sebelumnya
                </Link>
              ) : (
                <span />
              )}

              <span className="text-xs text-gray-500 dark:text-gray-400">
                Halaman {filters.page} dari {result.data.pagination.total_pages}
              </span>

              {filters.page < result.data.pagination.total_pages ? (
                <Link
                  href={enrollmentPageHref(filters.page + 1, filters)}
                  className="inline-flex min-h-[44px] items-center text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Berikutnya →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default function TenantEnrollmentsPage({ searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<EnrollmentsSkeleton />}>
        <EnrollmentsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
