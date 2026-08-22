import { formatTransactionAmount, formatTransactionDate, getTransactionStatus, transactionStatusLabels } from '@/lib/billing/formatters';
import Link from 'next/link';
import { getParentTransactions } from '../_queries/queries';

export default async function ParentTransactionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam || '1', 10) || 1);
  const result = await getParentTransactions({ page });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <Link href="/dashboard/parent" className="text-sm font-semibold text-blue-700">Kembali ke dashboard</Link>
      <h1 className="text-2xl font-bold">Transaksi</h1>
      {result.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.status === 401 ? 'Sesi Anda berakhir. Silakan login kembali.' : 'Transaksi gagal dimuat. Coba lagi nanti.'}</div>}
      {result.error ? null : result.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">Belum ada transaksi.</div>
      ) : (
        <div className="space-y-3">
          {result.data.map((item) => {
            const status = getTransactionStatus(item.status);
            return <Link key={item.id || item.transaction_id} href={`/dashboard/parent/transactions/${item.id || item.transaction_id}`} className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-400"><article><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{formatTransactionAmount(item.gross_amount, item.currency || 'IDR')}</p><span className={`rounded-full px-3 py-1 text-xs font-bold ${status === 'paid' ? 'bg-emerald-100 text-emerald-800' : status === 'pending' ? 'bg-amber-100 text-amber-800' : status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-700'}`}>{transactionStatusLabels[status]}</span></div><p className="mt-2 text-sm text-gray-500">Dibuat {formatTransactionDate(item.created_at)}</p></article></Link>;
          })}
        </div>
      )}
      {result.pagination && result.pagination.total_pages && result.pagination.total_pages > 1 && <nav aria-label="Pagination transaksi" className="flex items-center justify-between text-sm"><span>Halaman {result.pagination.page || page} dari {result.pagination.total_pages}</span><div className="flex gap-3">{page > 1 && <Link href={`/dashboard/parent/transactions?page=${page - 1}`} className="font-semibold text-blue-700">Sebelumnya</Link>}{page < result.pagination.total_pages && <Link href={`/dashboard/parent/transactions?page=${page + 1}`} className="font-semibold text-blue-700">Berikutnya</Link>}</div></nav>}
    </main>
  );
}