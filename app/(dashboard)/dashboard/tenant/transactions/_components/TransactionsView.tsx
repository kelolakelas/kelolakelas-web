import { formatCurrency } from '@/lib/payment-status';
import { canRefundTransaction } from '@/lib/transaction-refund';
import { TransactionFilterBar } from './TransactionFilterBar';
import { RefundTransactionButton } from './RefundTransactionButton';
import {
  transactionExportHref,
  transactionFeeTotal,
  transactionPageHref,
  type parseTransactionFilters,
  type TenantTransaction,
  type TransactionFilters,
} from '../_lib/transactions';
import type { getTenantTransactions } from '../_queries/transactions';

/**
 * Error panel for the states that stop the list from rendering at all.
 *
 * `forbidden` is presented as a permission state, not as a failure: billing
 * guards this endpoint with `billing:read`, so a member without that
 * permission is expected here and must not be shown a technical error. Every
 * other state is a genuine problem with the gateway or the backend.
 */
function TransactionErrorPanel({
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
        {isForbidden ? 'Akses ditolak' : 'Transaksi tidak tersedia'}
      </p>
      <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
        {isForbidden
          ? 'Anda tidak memiliki akses ke daftar transaksi.'
          : 'Daftar transaksi belum dapat dimuat.'}
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
 * Empty state shown when no transaction matches the current filters.
 *
 * An empty paid last-30-days window is a legitimate state of a working page
 * — a new tenant simply has no sales yet — so it is never reported as an
 * error.
 */
function EmptyTransactionsState() {
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
        Tidak ada transaksi pada rentang ini.
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        Ubah status, pencarian order ID, atau rentang tanggal untuk melihat transaksi yang lain.
      </p>
    </section>
  );
}

/** Billing's timestamps are UTC; format them in UTC so the label never shifts a day. */
function formatUtcDateTime(value: string | null): string {
  if (!value) return '—';
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(instant);
}

function TransactionTable({ rows, canRefund }: { rows: TenantTransaction[]; canRefund: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <th scope="col" className="px-4 py-3">Order ID</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3 text-right">Gross</th>
            <th scope="col" className="px-4 py-3 text-right">Fee</th>
            <th scope="col" className="px-4 py-3 text-right">Net</th>
            <th scope="col" className="px-4 py-3">Tanggal bayar (UTC)</th>
            {canRefund && (
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Aksi</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row) => (
            <tr key={row.id} className="text-gray-900 dark:text-gray-100">
              <td className="px-4 py-3 font-mono text-xs break-all">{row.merchant_order_id}</td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.gross_amount, row.currency)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(transactionFeeTotal(row), row.currency)}</td>
              <td className="px-4 py-3 text-right">{formatCurrency(row.net_amount, row.currency)}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatUtcDateTime(row.paid_at)}</td>
              {canRefund && (
                <td className="px-4 py-3">
                  {canRefundTransaction(row.status) && (
                    <RefundTransactionButton transaction={{ id: row.id, merchant_order_id: row.merchant_order_id }} />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Pagination controls for the transaction list (KEL-148).
 *
 * Each page link preserves the active status, search, and paid-date range,
 * following the report overview pattern.
 */
function TransactionPagination({
  filters,
  totalPages,
}: {
  filters: TransactionFilters;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const previous = filters.page > 1 ? { ...filters, page: filters.page - 1 } : null;
  const next = filters.page < totalPages ? { ...filters, page: filters.page + 1 } : null;

  return (
    <nav aria-label="Halaman transaksi" className="flex items-center justify-between gap-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Halaman {filters.page} dari {totalPages}
      </p>
      <div className="flex gap-3">
        {previous ? (
          <a
            href={transactionPageHref(previous)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
          >
            Sebelumnya
          </a>
        ) : null}
        {next ? (
          <a
            href={transactionPageHref(next)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
          >
            Berikutnya
          </a>
        ) : null}
      </div>
    </nav>
  );
}

/** Pure view of the list states, so each can be rendered and tested without a request. */
export function TransactionsView({
  filters,
  defaults,
  parsed,
  result,
  canRefund = false,
}: {
  filters: TransactionFilters;
  defaults: TransactionFilters;
  parsed: ReturnType<typeof parseTransactionFilters>;
  result: Awaited<ReturnType<typeof getTenantTransactions>>;
  canRefund?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 pb-4 border-b border-gray-200 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Transaksi
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Filter transaksi berdasarkan status, tanggal (UTC), dan order ID, lalu unduh
            CSV untuk filter yang aktif.
          </p>
        </div>
        {result.error === null && result.data.rows.length > 0 && (
          <a
            href={transactionExportHref(filters)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Unduh CSV
          </a>
        )}
      </div>

      {parsed.error === 'invalid_filter' && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm font-medium text-amber-900 dark:text-amber-200"
        >
          Filter tidak valid. Status harus salah satu nilai yang tersedia, tanggal harus
          berformat YYYY-MM-DD, dan tanggal mulai tidak boleh setelah tanggal selesai.
        </p>
      )}

      <TransactionFilterBar
        status={filters.status}
        search={filters.search}
        dateFrom={filters.date_from}
        dateTo={filters.date_to}
        defaultDateFrom={defaults.date_from}
        defaultDateTo={defaults.date_to}
        disabled={result.error === 'forbidden'}
      />

      {result.error === 'invalid_filter' ? null : result.error ? (
        <TransactionErrorPanel error={result.error} message={result.message} />
      ) : result.data.rows.length === 0 ? (
        <EmptyTransactionsState />
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {result.data.pagination.total_items} transaksi · filter aktif: {filters.status},{' '}
            {filters.date_from} – {filters.date_to}
            {filters.search ? ` · “${filters.search}”` : ''} (tanggal {filters.status === 'paid' ? 'bayar' : 'buat'}, UTC)
          </p>

          <TransactionTable rows={result.data.rows} canRefund={canRefund} />

          <TransactionPagination filters={filters} totalPages={result.data.pagination.total_pages} />
        </>
      )}
    </div>
  );
}
