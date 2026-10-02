'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addAccount, cancelWithdrawal, requestWithdrawal } from '../_actions/actions';
import { initialActionState, type Withdrawal } from '../_lib/finance';
import { formatCurrency } from '@/lib/payment-status';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{pending ? 'Memproses…' : children}</button>;
}

export function AccountForm() {
  const [state, action] = useActionState(addAccount, initialActionState);
  return <form action={action} className="space-y-3">
    <h3 className="font-semibold">Tambah rekening</h3>
    <label className="block">Kode bank<input className="block w-full rounded border p-2 text-gray-900" name="bank_code" maxLength={255} required /></label>
    <label className="block">Nomor rekening<input className="block w-full rounded border p-2 text-gray-900" name="account_number" maxLength={255} required autoComplete="off" /></label>
    <label className="block">Nama pemilik<input className="block w-full rounded border p-2 text-gray-900" name="account_name" maxLength={255} required /></label>
    {state.message && <p role="status">{state.message}</p>}
    <Submit>Simpan rekening</Submit>
  </form>;
}

export function WithdrawalForm({ available }: { available: number }) {
  const [state, action] = useActionState(requestWithdrawal, initialActionState);
  // Stable for retries and duplicate submits of this intent. A successful
  // request locks the form until a fresh page load creates a new intent/key.
  const [key] = useState(() => crypto.randomUUID());
  return <form action={action} className="space-y-3">
    <h3 className="font-semibold">Ajukan penarikan</h3>
    <p>Saldo tersedia: {formatCurrency(available, 'IDR')}</p>
    <label className="block">Nominal (IDR)<input className="block w-full rounded border p-2 text-gray-900" name="amount" type="number" min="1" max={available} step="1" required /></label>
    <input type="hidden" name="idempotency_key" value={key} />
    {state.message && <p role="status">{state.message}</p>}
    {!state.success && <Submit>Ajukan penarikan</Submit>}
  </form>;
}

export function CancelForm({ withdrawal }: { withdrawal: Withdrawal }) {
  const [state, action] = useActionState(cancelWithdrawal, initialActionState);
  return <form action={action} className="inline-flex items-center gap-2">
    <input type="hidden" name="id" value={withdrawal.id} />
    {state.message && <span role="status">{state.message}</span>}
    <Submit>Batalkan</Submit>
  </form>;
}
