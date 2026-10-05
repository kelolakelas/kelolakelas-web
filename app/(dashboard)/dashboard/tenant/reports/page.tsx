import type { Metadata } from 'next';
import { Suspense } from 'react';
import { readTenantNav } from '../_queries/membership';
import {
  EMPTY_REPORT_FILTERS,
  parseReportFilters,
  reportCountLabel,
  reportPageHref,
  reportWritePermissions,
  type ReportFilters,
} from './_lib/schema';
import { ReportCard } from './_components/ReportCard';
import { ReportFilterBar } from './_components/ReportFilterBar';
import { ReportFormDialog } from './_components/ReportFormDialog';
import { ReportsSkeleton } from './_components/ReportsSkeleton';
import { getTenantReports } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Laporan Evaluasi - Tenant Dashboard',
  description:
    'Tulis dan kelola laporan evaluasi siswa: buat laporan baru, ubah laporan kelas yang Anda ajar, dan cari berdasarkan siswa dan tanggal.',
  alternates: {
    canonical: '/dashboard/tenant/reports',
  },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Error panel for the states that stop the list from rendering at all.
 *
 * `forbidden` is presented as a permission state, not as a failure: the
 * academic service guards this endpoint with `report:read`, so a member
 * without that permission is expected here and must not be shown a technical
 * error. Every other state is a genuine problem with the gateway or the
 * backend.
 */
function ReportErrorPanel({
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
        {isForbidden ? 'Akses ditolak' : 'Laporan tidak tersedia'}
      </p>
      <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        {isForbidden
          ? 'Anda tidak memiliki akses ke daftar laporan.'
          : 'Daftar laporan belum dapat dimuat.'}
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
 * Empty state shown when no report matches the current filters.
 *
 * Both reasons are legitimate states of a working page — a tenant with no
 * reports yet, or a filter that excluded everything — so neither is
 * reported as an error.
 */
function EmptyReportsState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 sm:p-12 text-center shadow-xs">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
        {isFiltered ? 'Tidak ada laporan yang cocok dengan filter.' : 'Belum ada laporan evaluasi.'}
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {isFiltered
          ? 'Ubah pencarian, siswa, atau rentang tanggal, atau atur ulang filter untuk melihat laporan yang lain.'
          : 'Buat laporan evaluasi pertama untuk siswa yang Anda ajar dari halaman ini.'}
      </p>
    </section>
  );
}

/**
 * Pagination controls for the report list (KEL-139).
 *
 * The page window is small on purpose: the academic default is 20 rows, and
 * the filter form round-trips the full state through the URL, so each page
 * link preserves the active search, enrollment, and date range.
 */
function ReportPagination({
  filters,
  totalPages,
}: {
  filters: ReportFilters;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const previous = filters.page > 1 ? { ...filters, page: filters.page - 1 } : null;
  const next = filters.page < totalPages ? { ...filters, page: filters.page + 1 } : null;

  return (
    <nav aria-label="Halaman laporan" className="flex items-center justify-between gap-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Halaman {filters.page} dari {totalPages}
      </p>
      <div className="flex gap-3">
        {previous ? (
          <a
            href={reportPageHref(previous)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
          >
            Sebelumnya
          </a>
        ) : null}
        {next ? (
          <a
            href={reportPageHref(next)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
          >
            Berikutnya
          </a>
        ) : null}
      </div>
    </nav>
  );
}

/**
 * The tenant's student evaluation reports (KEL-139).
 *
 * The page is a Server Component so the gateway reads happen with the
 * session cookies and the tenant is derived from the JWT claim server-side.
 * The only filters this screen can change are the search text, the
 * enrollment, and the `YYYY-MM-DD` date range the backend parses — there
 * is no `class_id` filter because the report endpoint understands none.
 *
 * Writes are gated per action on the matching `report:*` permission; the
 * backend stays the access authority and refuses the mutation with the
 * same permission, this only decides what the dashboard offers. A tutor
 * who does not teach the report's class meets the assignment message from
 * the Server Action, because only the backend knows the assignment.
 */
async function ReportsContent({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = parseReportFilters(params);
  const filters: ReportFilters = parsed.filters ?? EMPTY_REPORT_FILTERS;
  const result = await getTenantReports(params);

  // Fail-closed per action: offered only on a confirmed membership with the
  // matching permission; an unreadable membership hides every mutation.
  const nav = await readTenantNav();
  const { canCreate, canUpdate, canDelete } = reportWritePermissions(nav);

  const isFiltered =
    filters.search !== '' ||
    filters.enrollment_id !== '' ||
    filters.date_from !== '' ||
    filters.date_to !== '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 pb-4 border-b border-gray-200 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Laporan Evaluasi
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tulis laporan evaluasi untuk siswa yang Anda ajar, lalu kelola dari halaman ini.
          </p>
        </div>
        {canCreate && result.error === null && (
          <ReportFormDialog
            mode="create"
            enrollmentOptions={result.data.enrollments}
            idPrefix="report-create"
          />
        )}
      </div>

      {parsed.error === 'invalid_filter' && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm font-medium text-amber-900 dark:text-amber-200"
        >
          Filter tidak valid. Halaman harus berupa angka, siswa harus berupa ID yang valid, tanggal
          harus berformat YYYY-MM-DD, dan tanggal mulai tidak boleh setelah tanggal selesai.
        </p>
      )}

      <ReportFilterBar
        search={parsed.error === 'invalid_filter' ? '' : filters.search}
        enrollmentId={parsed.error === 'invalid_filter' ? '' : filters.enrollment_id}
        dateFrom={parsed.error === 'invalid_filter' ? '' : filters.date_from}
        dateTo={parsed.error === 'invalid_filter' ? '' : filters.date_to}
        enrollmentOptions={result.error === null ? result.data.enrollments : []}
        disabled={result.error === 'forbidden'}
      />

      {result.error === 'invalid_filter' ? null : result.error ? (
        <ReportErrorPanel error={result.error} message={result.message} />
      ) : result.data.rows.length === 0 ? (
        <EmptyReportsState isFiltered={isFiltered} />
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {reportCountLabel(result.data.pagination)}
            {isFiltered && ' · filter aktif'}
          </p>

          <div className="space-y-4">
            {result.data.rows.map((row, index) => (
              <ReportCard
                key={row.report.id}
                row={row}
                canUpdate={canUpdate}
                canDelete={canDelete}
                idPrefix={`report-${index}`}
              />
            ))}
          </div>

          <ReportPagination filters={filters} totalPages={result.data.pagination.total_pages} />
        </>
      )}
    </div>
  );
}

export default function TenantReportsPage({ searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
