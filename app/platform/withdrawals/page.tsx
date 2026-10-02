import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readPlatformWithdrawals } from '@/lib/platform-withdrawals';
import { DecisionForm } from './DecisionForm';

export const dynamic = 'force-dynamic';
const rupiah = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

export default async function PlatformWithdrawalsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const parsed = Number(query.page);
  const page = query.page && /^\d+$/.test(query.page) && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  const result = await readPlatformWithdrawals(page);
  if (result.status === 401) redirect('/platform/login');
  return <main className="mx-auto max-w-3xl space-y-6 p-6">
    <Link href="/platform" className="underline">Platform admin</Link>
    <h1 className="text-2xl font-semibold">Pending tenant withdrawals</h1>
    <p>Record a manual transfer only after verifying its destination and amount. This page does not initiate a transfer.</p>
    {result.status !== 200 || !result.data ? <p role="alert">{result.message}</p> : <>
      {result.data.items.length === 0 ? <p>No pending withdrawals.</p> : <ul className="space-y-6">{result.data.items.map(item => <li key={item.id} className="space-y-2 rounded border p-4">
        <h2 className="font-semibold">Tenant {item.tenant_id}</h2>
        <p>Amount: {rupiah(item.amount)} · Admin fee: {rupiah(item.admin_fee)} · Net payout: {rupiah(item.net_amount)}</p>
        <p>Destination: {item.bank_code} · {item.account_number} · {item.account_name}</p>
        <p>Requested: {item.requested_at}</p>
        <DecisionForm id={item.id} destination={`${item.bank_code} ${item.account_number}`} />
      </li>)}</ul>}
      <nav aria-label="Withdrawal pages" className="flex gap-4">
        {page > 1 && <Link className="underline" href={`/platform/withdrawals?page=${page - 1}`}>Previous</Link>}
        <span>Page {page} of {Math.max(1, result.data.pagination.total_pages)} · {result.data.pagination.total_items} pending</span>
        {page < result.data.pagination.total_pages && <Link className="underline" href={`/platform/withdrawals?page=${page + 1}`}>Next</Link>}
      </nav>
    </>}
  </main>;
}
