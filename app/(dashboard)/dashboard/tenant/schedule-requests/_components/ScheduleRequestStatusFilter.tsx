'use client';

import { useState } from 'react';
import { scheduleRequestStatusLabel } from '@/lib/schedule-request';
import { TENANT_SCHEDULE_REQUESTS_PATH } from '../_lib/schema';

const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'cancelled'] as const;

/**
 * Status filter for the tenant schedule-request work queue (KEL-110).
 *
 * The form submits with `GET` to the same route, so the active filter lives in
 * the URL and a filtered view is shareable and refreshable. The select is
 * uncontrolled (its `defaultValue` comes from the URL). Unlike the enrollment
 * overview there is no "all statuses" option: the list defaults to the pending
 * work queue and every option is a status the backend accepts, validated on the
 * server by `parseScheduleRequestFilters`.
 */
export function ScheduleRequestStatusFilter({
  status,
  disabled,
}: {
  status: string;
  disabled?: boolean;
}) {
  const [isPending, setIsPending] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        action={TENANT_SCHEDULE_REQUESTS_PATH}
        onSubmit={() => setIsPending(true)}
      >
        <div className="flex-1">
          <label
            htmlFor="schedule-request-status"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Status permintaan
          </label>
          <select
            id="schedule-request-status"
            name="status"
            defaultValue={status || 'pending'}
            disabled={disabled || isPending}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {scheduleRequestStatusLabel(option)}
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
        </div>
      </form>
    </div>
  );
}
