'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TENANT_SESSIONS_PATH } from '../_lib/schema';

/**
 * Range and class filter for the tutor session overview (KEL-137).
 *
 * The form submits with `GET` to the same route, so the active filter lives
 * in the URL and a filtered view is shareable and refreshable. The selects
 * are uncontrolled (their `defaultValue` comes from the URL) and the reset
 * button navigates explicitly, because a plain `GET` form cannot clear a
 * parameter by submitting an empty value.
 *
 * The submitted values are validated on the server by
 * `parseSessionFilters` against the backend's own vocabulary (`today` /
 * `week`, UUID class), so this control only has to offer the two ranges the
 * backend date window understands.
 */
export function SessionRangeFilter({
  range,
  classId,
  classOptions,
  disabled,
}: {
  range: string;
  classId: string;
  classOptions: readonly { id: string; name: string }[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        action={TENANT_SESSIONS_PATH}
        onSubmit={() => setIsPending(true)}
      >
        <div className="flex-1">
          <label
            htmlFor="session-range"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Rentang sesi
          </label>
          <select
            id="session-range"
            name="range"
            defaultValue={range}
            disabled={disabled || isPending}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          >
            <option value="today">Hari ini</option>
            <option value="week">Minggu ini</option>
          </select>
        </div>

        <div className="flex-1">
          <label
            htmlFor="session-class"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Kelas
          </label>
          <select
            id="session-class"
            name="class_id"
            defaultValue={classId}
            disabled={disabled || isPending}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          >
            <option value="">Semua kelas</option>
            {classOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
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

          {(range !== 'today' || classId !== '') && (
            <button
              type="button"
              onClick={() => {
                setIsPending(true);
                router.push(TENANT_SESSIONS_PATH);
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
