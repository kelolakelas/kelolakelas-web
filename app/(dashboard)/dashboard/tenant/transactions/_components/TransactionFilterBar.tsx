'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { TENANT_TRANSACTIONS_PATH, TRANSACTION_STATUSES } from '../_lib/transactions';

/**
 * Status, order-id, and paid-date filter for the transaction overview
 * (KEL-148).
 *
 * The form submits with `GET` to the same route, so the active filter lives
 * in the URL and a filtered view is shareable and refreshable. The controls
 * are uncontrolled (their `defaultValue` comes from the URL) and the reset
 * button navigates explicitly, because a plain `GET` form cannot clear a
 * parameter by submitting an empty value.
 *
 * The submitted values are validated on the server by
 * `parseTransactionFilters` against the backend's own vocabulary, so this
 * control only has to offer the filters the transaction list endpoint
 * understands.
 */
export function TransactionFilterBar({
  status,
  search,
  dateFrom,
  dateTo,
  defaultDateFrom,
  defaultDateTo,
  disabled,
}: {
  status: string;
  search: string;
  dateFrom: string;
  dateTo: string;
  /** Default window the bare route resolves to; reset returns to these. */
  defaultDateFrom: string;
  defaultDateTo: string;
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
  // The bare route resolves to the paid last-30-days defaults, so reset
  // returns there instead of to an empty range the screen never shows.
  const isFiltered =
    search !== '' || status !== 'paid' || dateFrom !== defaultDateFrom || dateTo !== defaultDateTo;
  // Reset (and any other URL change) keeps this component mounted, while the
  // uncontrolled controls below only read their `defaultValue` on mount. Key
  // the form by the URL-derived values so a filter change remounts the form
  // subtree and every control re-initialises from the new defaults.
  const formKey = [status, search, dateFrom, dateTo].join('|');

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs">
      <form
        key={formKey}
        className="flex flex-col gap-3 lg:flex-row lg:items-end"
        action={TENANT_TRANSACTIONS_PATH}
        onSubmit={() => setIsSubmitPending(true)}
      >
        <div className="flex-1">
          <label
            htmlFor="transaction-status"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Status
          </label>
          <select
            id="transaction-status"
            name="status"
            defaultValue={status}
            disabled={disabled}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          >
            {TRANSACTION_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label
            htmlFor="transaction-search"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Cari order ID
          </label>
          <input
            id="transaction-search"
            name="search"
            type="search"
            defaultValue={search}
            disabled={disabled}
            placeholder="Merchant order ID"
            maxLength={255}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="transaction-date-from"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Dari tanggal bayar
          </label>
          <input
            id="transaction-date-from"
            name="date_from"
            type="date"
            defaultValue={dateFrom}
            disabled={disabled}
            className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="transaction-date-to"
            className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Sampai tanggal bayar
          </label>
          <input
            id="transaction-date-to"
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
                  router.push(TENANT_TRANSACTIONS_PATH);
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
