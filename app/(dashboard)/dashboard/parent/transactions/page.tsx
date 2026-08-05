import Link from 'next/link';
import { getParentTransactions } from '../_queries/queries';

export default async function ParentTransactionsPage() {
  const result = await getParentTransactions({ page: 1 });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <Link href="/dashboard/parent" className="text-sm font-semibold text-blue-700">Kembali ke dashboard</Link>
      <h1 className="text-2xl font-bold">Transaksi</h1>
      {result.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.error}</div>}
      {result.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">Belum ada transaksi.</div>
      ) : (
        <div className="space-y-3">
          {result.data.map((item) => (
            <article key={item.id || item.transaction_id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="font-semibold">{item.currency || 'IDR'} {item.gross_amount.toLocaleString('id-ID')}</p>
              <p className="text-sm text-gray-500">{item.status} · {item.paid_at || 'Belum dibayar'}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}