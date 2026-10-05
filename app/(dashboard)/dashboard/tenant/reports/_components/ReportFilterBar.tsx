'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { TENANT_REPORTS_PATH } from '../_lib/schema';

/**
 * Search, enrollment, and date filter for the report overview (KEL-139).
 *
 * The form submits with `GET` to the same route, so the active filter lives
 * in the URL and a filtered view is shareable and refreshable. The controls
 * are uncontrolled (their `defaultValue` comes from the URL) and the reset
 * button navigates explicitly, because a plain `GET` form cannot clear a
 * parameter by submitting an empty value.
 *
 * The submitted values are validated on the server by `parseReportFilters`
 * against the backend's own vocabulary, so this control only has to offer
 * the filters the report list endpoint understands.
 */
export function ReportFilterBar({
  search,
  enrollmentId,
  dateFrom,
  dateTo,
  enrollmentOptions,
  disabled,
}: {
  search: string;
  enrollmentId: string;
  dateFrom: string;
  dateTo: string;
  enrollmentOptions: readonly { enrollment_id: string; label: string }[];
  disabled?: boolean;
}) {
  const router = useRouter();
  // Submit performs a plain GET navigation (the form `action` is a URL), so
  // the page remounts and this flag resets naturally. The flag only ever
  // disables the submit button — never the named controls, which must stay
  // successful controls so the browser includes them in the GET data set.
  const [isSubmitPending, setIsSubmitPending] = useState(false);
  // Reset navigates client-side to the same route, which keeps this component
  // mounted. `useTransition` derives the pending state from the navigation
  // itself, so it recovers automatically instead of sticking at "Memuat…".
  const [isResetPending, startResetTransition] = useTransition();
  const isPending = isSubmitPending || isResetPending;
  const isFiltered = search !== '' || enrollmentId !== '' || dateFrom !== '' || dateTo !== '';
  // Reset (and any other URL change) keeps this component mounted, while the
  // uncontrolled controls below only read their `defaultValue` on mount. Key
  // the form by the URL-derived values so a filter change remounts the form
  // subtree and every control re-initialises from the new defaults.
  const formKey = [search, enrollmentId, dateFrom, dateTo].join('|');

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs">
      <form
        key={formKey}
        className="flex flex-col gap-3 lg:flex-row lg:items-end"
        action={TENANT_REPORTS_PATH}
        onSubmit={() => setIsSubmitPending(true)}
      >
        <div className="flex-1">
          <label
            htmlFor="report-search"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Cari laporan
          </label>
          <input
            id="report-search"
            name="search"
            type="search"
            defaultValue={search}
            disabled={disabled}
            placeholder="Judul atau catatan evaluasi"
            maxLength={255}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="report-enrollment"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Siswa
          </label>
          <select
            id="report-enrollment"
            name="enrollment_id"
            defaultValue={enrollmentId}
            disabled={disabled}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          >
            <option value="">Semua siswa</option>
            {enrollmentOptions.map((option) => (
              <option key={option.enrollment_id} value={option.enrollment_id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label
            htmlFor="report-date-from"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Dari tanggal
          </label>
          <input
            id="report-date-from"
            name="date_from"
            type="date"
            defaultValue={dateFrom}
            disabled={disabled}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="report-date-to"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Sampai tanggal
          </label>
          <input
            id="report-date-to"
            name="date_to"
            type="date"
            defaultValue={dateTo}
            disabled={disabled}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={disabled || isPending}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
          >
            {isPending ? 'Memuat…' : 'Terapkan'}
          </button>

          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                startResetTransition(() => {
                  router.push(TENANT_REPORTS_PATH);
                });
              }}
              disabled={isResetPending}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
            >
              Atur ulang
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
