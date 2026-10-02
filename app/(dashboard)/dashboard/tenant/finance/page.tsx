import Link from 'next/link';
import { formatCurrency } from '@/lib/payment-status';
import { readTenantNav } from '../_queries/membership';
import { AccountForm, CancelForm, WithdrawalForm } from './_components/FinanceForms';
import { FINANCE_PATH, parsePage, type FinanceRead } from './_lib/finance';
import { readAccounts, readLedger, readWallet, readWithdrawals } from './_queries/finance';

interface Props { searchParams: Promise<Record<string, string | string[] | undefined>> }
function Failure({ state }: { state: FinanceRead<unknown>['state'] }) {
  return <p role="alert" className="rounded border border-amber-300 p-4">{state === 'forbidden' ? 'Anda tidak memiliki akses untuk melihat data ini.' : 'Data keuangan tidak dapat dimuat. Muat ulang halaman dan coba lagi.'}</p>;
}
function Pages({ page, total, kind }: { page: number; total: number; kind: 'ledger' | 'withdrawals' }) {
  const link = (next: number) => `${FINANCE_PATH}?${kind}=${next}`;
  return <nav aria-label={`${kind} pages`} className="flex gap-4 text-sm">
    {page > 1 && <Link className="underline" href={link(page - 1)}>Sebelumnya</Link>}
    <span>Halaman {page} dari {Math.max(1, total)}</span>
    {page < total && <Link className="underline" href={link(page + 1)}>Berikutnya</Link>}
  </nav>;
}
export default async function FinancePage({ searchParams }: Props) {
  const params = await searchParams;
  const ledgerPage = parsePage(params.ledger);
  const withdrawalPage = parsePage(params.withdrawals);
  const [membership, wallet, ledger] = await Promise.all([readTenantNav(), readWallet(), readLedger(ledgerPage)]);
  const canWithdraw = membership.state === 'ok' && membership.membership.permissions.includes('billing:withdraw');
  const [accounts, withdrawals] = canWithdraw ? await Promise.all([readAccounts(), readWithdrawals(withdrawalPage)]) : [null, null];
  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <header><h1 className="text-2xl font-bold">Keuangan</h1><p>Saldo, mutasi, rekening, dan pengajuan penarikan tenant.</p></header>
    <section className="rounded-xl border p-5"><h2 className="text-lg font-semibold">Saldo</h2>
      {wallet.state === 'ok' ? <div className="grid gap-4 sm:grid-cols-2"><p>Tersedia: <strong>{formatCurrency(wallet.data.available_balance, 'IDR')}</strong></p><p>Tertahan: <strong>{formatCurrency(wallet.data.pending_balance, 'IDR')}</strong></p></div> : <Failure state={wallet.state} />}
    </section>
    <section className="rounded-xl border p-5"><h2 className="text-lg font-semibold">Mutasi</h2>
      {ledger.state !== 'ok' ? <Failure state={ledger.state} /> : <><ul className="divide-y">{ledger.data.items.map((item) => <li key={item.id} className="py-3"><strong>{item.entry_type}</strong> — {formatCurrency(item.amount, 'IDR')}<br/><span className="text-sm">{item.description || item.created_at}</span></li>)}</ul>{ledger.data.items.length === 0 && <p>Belum ada mutasi.</p>}<Pages page={ledgerPage} total={ledger.data.pagination.total_pages} kind="ledger" /></>}
    </section>
    {membership.state !== 'ok' && <Failure state={membership.state === 'forbidden' ? 'forbidden' : 'error'} />}
    {canWithdraw && <><section className="rounded-xl border p-5"><h2 className="text-lg font-semibold">Rekening pencairan</h2>
      {accounts?.state !== 'ok' ? <Failure state={accounts?.state || 'error'} /> : <><ul className="mb-4 divide-y">{accounts.data.items.map((account) => <li key={account.id} className="py-2">{account.bank_code} — {account.account_name} — {account.account_number}{account.is_primary && ' (Utama)'}</li>)}</ul>{accounts.data.items.length === 0 && <p>Belum ada rekening.</p>}<AccountForm /></>}
    </section><section className="rounded-xl border p-5"><h2 className="text-lg font-semibold">Penarikan</h2>
      {wallet.state === 'ok' && accounts?.state === 'ok' && accounts.data.items.some((account) => account.is_primary) && <WithdrawalForm available={wallet.data.available_balance} />}
      {accounts?.state === 'ok' && !accounts.data.items.some((account) => account.is_primary) && <p>Tambahkan rekening utama sebelum mengajukan penarikan.</p>}
      {withdrawals?.state !== 'ok' ? <Failure state={withdrawals?.state || 'error'} /> : <><ul className="divide-y">{withdrawals.data.items.map((withdrawal) => <li key={withdrawal.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span>{formatCurrency(withdrawal.amount, 'IDR')} — {withdrawal.status} — {withdrawal.bank_code} {withdrawal.account_number}</span>{withdrawal.status === 'requested' && <CancelForm withdrawal={withdrawal} />}</li>)}</ul>{withdrawals.data.items.length === 0 && <p>Belum ada pengajuan.</p>}<Pages page={withdrawalPage} total={withdrawals.data.pagination.total_pages} kind="withdrawals" /></>}
    </section></>}
  </main>;
}
