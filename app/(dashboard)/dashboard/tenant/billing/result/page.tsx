import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Payment Result - Tenant Dashboard', alternates: { canonical: '/dashboard/tenant/billing/result' } };

export default async function BillingResultPage({ searchParams }: { searchParams: Promise<{ status?: string; transaction_id?: string }> }) {
  const params = await searchParams;
  const status = params.status || 'returned by gateway';
  return <main className="mx-auto max-w-2xl px-4 py-10"><section className="rounded-xl border border-gray-200 bg-white p-6"><h1 className="text-2xl font-bold">Payment result</h1><p className="mt-3 text-gray-700">Status dari payment gateway: <strong>{status}</strong></p>{params.transaction_id && <p className="mt-1 text-sm text-gray-600">Transaction ID: {params.transaction_id}</p>}<p className="mt-4 text-sm text-gray-600">History transaksi dapat memuat status yang telah dipersist oleh backend.</p><Link href="/dashboard/tenant/billing" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">Buka transaction history</Link></section></main>;
}
