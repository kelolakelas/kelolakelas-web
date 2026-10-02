import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readPlatformWithdrawalHistory, readPlatformWithdrawals } from '@/lib/platform-withdrawals';
import { DecisionForm } from './DecisionForm';

export const dynamic = 'force-dynamic';
const rupiah = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

const parsePage = (value: string | undefined): number => {
  const parsed = Number(value);
  return value && /^\d+$/.test(value) && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
};

export default async function PlatformWithdrawalsPage({ searchParams }: { searchParams: Promise<{ page?: string; history_page?: string }> }) {
  const query = await searchParams;
  const page = parsePage(query.page);
  const historyPage = parsePage(query.history_page);
  const result = await readPlatformWithdrawals(page);
  if (result.status === 401) redirect('/platform/login');
  const history = await readPlatformWithdrawalHistory(historyPage);
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
        {page > 1 && <Link className="underline" href={`/platform/withdrawals?page=${page - 1}&history_page=${historyPage}`}>Previous</Link>}
        <span>Page {page} of {Math.max(1, result.data.pagination.total_pages)} · {result.data.pagination.total_items} pending</span>
        {page < result.data.pagination.total_pages && <Link className="underline" href={`/platform/withdrawals?page=${page + 1}&history_page=${historyPage}`}>Next</Link>}
      </nav>
    </>}
    <section aria-labelledby="decision-history" className="space-y-4">
      <h2 id="decision-history" className="text-xl font-semibold">Recent decisions</h2>
      {history.status !== 200 || !history.data ? <p role="alert">{history.message}</p> : <>
        {history.data.items.length === 0 ? <p>No decisions recorded yet.</p> : <ul className="space-y-6">{history.data.items.map(item => <li key={item.id} className="space-y-2 rounded border p-4">
          <h3 className="font-semibold">Tenant {item.tenant_id} · {item.status === 'paid' ? 'Paid' : 'Rejected'}</h3>
          <p>Amount: {rupiah(item.amount)} · Admin fee: {rupiah(item.admin_fee)} · Net payout: {rupiah(item.net_amount)}</p>
          <p>Destination: {item.bank_code} · {item.account_number} · {item.account_name}</p>
          <p>Requested: {item.requested_at}</p>
          <p>Decided: {item.decided_at} by {item.decided_by}</p>
          {item.status === 'paid' ? <p>Transfer reference: {item.transfer_reference}</p> : <p>Rejection reason: {item.reject_reason}</p>}
        </li>)}</ul>}
        <nav aria-label="Decision history pages" className="flex gap-4">
          {historyPage > 1 && <Link className="underline" href={`/platform/withdrawals?page=${page}&history_page=${historyPage - 1}`}>Previous</Link>}
          <span>Page {historyPage} of {Math.max(1, history.data.pagination.total_pages)} · {history.data.pagination.total_items} decided</span>
          {historyPage < history.data.pagination.total_pages && <Link className="underline" href={`/platform/withdrawals?page=${page}&history_page=${historyPage + 1}`}>Next</Link>}
        </nav>
      </>}
    </section>
  </main>;
}
