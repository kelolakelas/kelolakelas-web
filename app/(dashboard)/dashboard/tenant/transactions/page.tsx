import type { Metadata } from 'next';
import { hasRefundPermission } from '@/lib/transaction-refund';
import { readTenantNav } from '../_queries/membership';
import { defaultTransactionFilters, parseTransactionFilters, type TransactionFilters } from './_lib/transactions';
import { getTenantTransactions } from './_queries/transactions';
import { TransactionsView } from './_components/TransactionsView';

export const metadata: Metadata = {
  title: 'Transaksi - Tenant Dashboard',
  description:
    'Lihat daftar transaksi tenant berdasarkan status, tanggal, dan order ID, lalu unduh CSV untuk filter yang aktif.',
  alternates: {
    canonical: '/dashboard/tenant/transactions',
  },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The tenant's transaction list with paid-date filters and CSV download
 * (KEL-148).
 *
 * The page is a Server Component so the gateway reads happen with the
 * session cookies and the tenant is derived from the JWT claim server-side.
 * The CSV download goes through the `export` route on this screen with the
 * same filter parameters, so the file always covers the rows the list shows
 * and the gateway token never reaches the browser.
 */
export default async function TenantTransactionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = parseTransactionFilters(params);
  const defaults = defaultTransactionFilters();
  const filters: TransactionFilters = parsed.filters ?? {
    page: 1,
    status: 'paid',
    search: '',
    date_from: defaults.date_from,
    date_to: defaults.date_to,
  };
  const [result, membership] = await Promise.all([getTenantTransactions(params), readTenantNav()]);
  const canRefund =
    membership.state === 'ok' && hasRefundPermission(membership.membership.permissions);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <TransactionsView filters={filters} defaults={defaults} parsed={parsed} result={result} canRefund={canRefund} />
    </main>
  );
}
