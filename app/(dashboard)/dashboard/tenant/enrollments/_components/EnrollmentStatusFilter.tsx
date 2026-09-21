'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ENROLLMENT_STATUS_OPTIONS, TENANT_ENROLLMENTS_PATH } from '../_lib/schema';

/**
 * Status filter for the tenant enrollment overview (KEL-33).
 *
 * The form submits with `GET` to the same route, so the active filter lives in
 * the URL and a filtered view is shareable and refreshable. The select is
 * uncontrolled (its `defaultValue` comes from the URL) and the reset button
 * navigates explicitly, because a plain `GET` form cannot clear a parameter by
 * submitting an empty value.
 *
 * The submitted value is validated on the server by `parseEnrollmentFilters`
 * against the academic service's own vocabulary, so this control only has to
 * offer the four statuses the backend accepts.
 */
export function EnrollmentStatusFilter({
  status,
  disabled,
}: {
  status: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        action={TENANT_ENROLLMENTS_PATH}
        onSubmit={() => setIsPending(true)}
      >
        <div className="flex-1">
          <label
            htmlFor="enrollment-status"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Status enrollment
          </label>
          <select
            id="enrollment-status"
            name="status"
            defaultValue={status}
            disabled={disabled || isPending}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          >
            <option value="">Semua status</option>
            {ENROLLMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={disabled || isPending}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
          >
            {isPending ? 'Memuat…' : 'Terapkan'}
          </button>

          {status !== '' && (
            <button
              type="button"
              onClick={() => {
                setIsPending(true);
                router.push(TENANT_ENROLLMENTS_PATH);
              }}
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
