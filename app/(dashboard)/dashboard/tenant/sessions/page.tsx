import type { Metadata } from 'next';
import { Suspense } from 'react';
import { readTenantNav } from '../_queries/membership';
import {
  EMPTY_SESSION_FILTERS,
  parseSessionFilters,
  sessionCountLabel,
  type SessionFilters,
} from './_lib/schema';
import { SessionCard } from './_components/SessionCard';
import { SessionRangeFilter } from './_components/SessionRangeFilter';
import { SessionsSkeleton } from './_components/SessionsSkeleton';
import { getTutorSessions } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Sesi Saya - Tenant Dashboard',
  description:
    'Lihat sesi Anda hari ini dan minggu ini, termasuk sesi reschedule, lalu catat kehadiran seluruh siswa dari dashboard.',
  alternates: {
    canonical: '/dashboard/tenant/sessions',
  },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Error panel for the states that stop the list from rendering at all.
 *
 * `forbidden` is presented as a permission state, not as a failure: the
 * academic service guards this endpoint with `schedule:read`, so a member
 * without that permission is expected here and must not be shown a technical
 * error. Every other state is a genuine problem with the gateway or the
 * backend.
 */
function SessionErrorPanel({
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
        {isForbidden ? 'Akses ditolak' : 'Sesi tidak tersedia'}
      </p>
      <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        {isForbidden
          ? 'Anda tidak memiliki akses ke daftar sesi.'
          : 'Daftar sesi belum dapat dimuat.'}
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
 * Empty state shown when the tutor has no session in the selected slice.
 *
 * Both reasons are legitimate states of a working page — a day with no
 * teaching load, or a class filter that excluded everything — so neither is
 * reported as an error.
 */
function EmptySessionsState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 sm:p-12 text-center shadow-xs">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
        {isFiltered ? 'Tidak ada sesi yang cocok dengan filter.' : 'Tidak ada sesi pada rentang ini.'}
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {isFiltered
          ? 'Ubah rentang atau kelas, atau atur ulang filter untuk melihat sesi Anda yang lain.'
          : 'Belum ada sesi yang dijadwalkan untuk Anda pada rentang ini, termasuk sesi reschedule.'}
      </p>
    </section>
  );
}

/**
 * The tutor's own sessions for today and this week (KEL-137).
 *
 * The page is a Server Component so the gateway reads happen with the
 * session cookies and the tenant is derived from the JWT claim server-side.
 * Nothing on this page filters by tenant or by tutor in the browser: the
 * academic service scopes every row itself (`mine=true` derives the tutor
 * from the JWT), and the only filters this screen can change are the
 * Jakarta day/week range and the class the backend has already validated.
 */
async function SessionsContent({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = parseSessionFilters(params);
  const filters: SessionFilters = parsed.filters ?? EMPTY_SESSION_FILTERS;
  const result = await getTutorSessions(params);

  // The attendance dialog is gated on `attendance:create` (KEL-137): the
  // backend stays the access authority and the action refuses the save with
  // the same permission, this only decides what the dashboard offers. When
  // the membership cannot be read the form stays visible and the backend
  // decides — hiding a working form over a hiccup would be the worse
  // failure.
  const nav = await readTenantNav();
  const canRecordAttendance =
    nav.state !== 'ok' || nav.membership.permissions.includes('attendance:create');

  const isFiltered = filters.range !== 'today' || filters.class_id !== '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Sesi Saya
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Lihat sesi Anda hari ini dan minggu ini, termasuk sesi reschedule, lalu catat
            kehadiran seluruh siswa dari halaman ini.
          </p>
        </div>
      </div>

      {parsed.error === 'invalid_filter' && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm font-medium text-amber-900 dark:text-amber-200"
        >
          Filter tidak valid. Rentang sesi hanya menerima hari ini atau minggu ini, dan kelas
          harus berupa ID yang valid.
        </p>
      )}

      <SessionRangeFilter
        range={parsed.error === 'invalid_filter' ? 'today' : filters.range}
        classId={parsed.error === 'invalid_filter' ? '' : filters.class_id}
        classOptions={result.error === null ? result.data.classes : []}
        disabled={result.error === 'forbidden'}
      />

      {result.error === 'invalid_filter' ? null : result.error ? (
        <SessionErrorPanel error={result.error} message={result.message} />
      ) : result.data.rows.length === 0 ? (
        <EmptySessionsState isFiltered={isFiltered} />
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {sessionCountLabel(result.data.pagination)}
            {filters.range === 'today' ? ' · hari ini' : ' · minggu ini'}
            {filters.class_id !== '' && ' · filter kelas'}
          </p>

          <div className="space-y-4">
            {result.data.rows.map((row, index) => (
              <SessionCard
                key={row.session.id}
                row={row}
                canRecordAttendance={canRecordAttendance}
                idPrefix={`session-${index}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function TenantSessionsPage({ searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<SessionsSkeleton />}>
        <SessionsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
