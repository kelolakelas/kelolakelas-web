import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  DEFAULT_SCHEDULE_REQUEST_FILTERS,
  parseScheduleRequestFilters,
  scheduleRequestCountLabel,
} from './_lib/schema';
import { ScheduleRequestStatusFilter } from './_components/ScheduleRequestStatusFilter';
import { ScheduleRequestTable } from './_components/ScheduleRequestTable';
import { ScheduleRequestsSkeleton } from './_components/ScheduleRequestsSkeleton';
import { getTenantScheduleRequests } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Permintaan Jadwal - Tenant Dashboard',
  description:
    'Tinjau permintaan jadwal private dari parent: setujui dengan tautan pembayaran atau tolak dengan alasan.',
  alternates: {
    canonical: '/dashboard/tenant/schedule-requests',
  },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Error panel for the states that stop the list from rendering at all.
 *
 * `forbidden` is presented as a permission state, not as a failure: the
 * academic service guards this endpoint with `enrollment:read`, so a member
 * without that permission is expected here and must not be shown a technical
 * error. Every other state is a genuine problem with the gateway or the
 * backend.
 */
function ScheduleRequestErrorPanel({
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
        {isForbidden ? 'Akses ditolak' : 'Permintaan jadwal tidak tersedia'}
      </p>
      <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        {isForbidden
          ? 'Anda tidak memiliki akses ke daftar permintaan jadwal.'
          : 'Daftar permintaan jadwal belum dapat dimuat.'}
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
 * Private schedule request work queue for the active tenant (KEL-110).
 *
 * The page is a Server Component so the gateway reads happen with the session
 * cookies and the tenant is derived from the JWT claim server-side. Nothing on
 * this page filters by tenant in the browser: the academic service scopes every
 * row itself, and the only filter this screen can change is the request status
 * the backend has already validated. Approving or rejecting a row happens
 * through the dialogs on each pending row, guarded by `enrollment:update`.
 */
async function ScheduleRequestsContent({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = parseScheduleRequestFilters(params);
  const filters = parsed.filters ?? { ...DEFAULT_SCHEDULE_REQUEST_FILTERS };
  const result =
    parsed.error === 'invalid_filter' ? null : await getTenantScheduleRequests(params, filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Permintaan Jadwal Private
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tinjau permintaan jadwal private dari parent. Setujui untuk menerbitkan tautan
            pembayaran, atau tolak dengan alasan yang dapat dikosongkan.
          </p>
        </div>
      </div>

      {parsed.error === 'invalid_filter' && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm font-medium text-amber-900 dark:text-amber-200"
        >
          Filter tidak valid. Status permintaan jadwal hanya menerima pending, approved,
          rejected, atau cancelled.
        </p>
      )}

      <ScheduleRequestStatusFilter
        status={parsed.error === 'invalid_filter' ? '' : filters.status}
        disabled={result?.error === 'forbidden'}
      />

      {result === null || result.error === 'invalid_filter' ? null : result.error ? (
        <ScheduleRequestErrorPanel error={result.error} message={result.message} />
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {scheduleRequestCountLabel(result.data.total)}
            {filters.status !== '' && ` · filter status ${filters.status}`}
          </p>

          <ScheduleRequestTable rows={result.data.rows} />
        </>
      )}
    </div>
  );
}

export default function TenantScheduleRequestsPage({ searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<ScheduleRequestsSkeleton />}>
        <ScheduleRequestsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
