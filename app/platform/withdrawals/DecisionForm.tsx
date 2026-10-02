'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { decideWithdrawal, type WithdrawalActionState } from './actions';

const initial: WithdrawalActionState = { status: 0, message: '' };

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded bg-blue-600 px-4 py-3 text-white disabled:opacity-50">{pending ? 'Saving…' : 'Confirm decision'}</button>;
}

export function DecisionForm({ id, destination }: { id: string; destination: string }) {
  const [state, action] = useActionState(decideWithdrawal, initial);
  const [decision, setDecision] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.status === 200) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state, router]);

  return <div className="space-y-2">
    <button ref={triggerRef} type="button" onClick={() => dialogRef.current?.showModal()} className="rounded bg-blue-600 px-4 py-3 text-white">Review withdrawal</button>
    <dialog ref={dialogRef} aria-labelledby={`withdrawal-title-${id}`} onClose={() => triggerRef.current?.focus()} className="max-w-md rounded border bg-white p-6">
      <h2 id={`withdrawal-title-${id}`} className="text-lg font-bold">Confirm decision for {destination}?</h2>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={id} />
        <div><label htmlFor={`decision-${id}`} className="block">Decision</label><select id={`decision-${id}`} name="decision" required value={decision} onChange={event => setDecision(event.target.value)} className="rounded border p-2"><option value="">Select decision</option><option value="paid">Record payment</option><option value="reject">Reject</option></select></div>
        {decision === 'paid' && <div><label htmlFor={`reference-${id}`} className="block">Transfer reference</label><input id={`reference-${id}`} name="transfer_reference" required maxLength={255} className="w-full rounded border p-2" /></div>}
        {decision === 'reject' && <div><label htmlFor={`reason-${id}`} className="block">Rejection reason</label><textarea id={`reason-${id}`} name="reason" required maxLength={2000} className="w-full rounded border p-2" /></div>}
        <div className="flex gap-2"><button type="button" onClick={() => dialogRef.current?.close()} className="rounded border px-4 py-3">Cancel</button><Submit /></div>
      </form>
    </dialog>
    {state.message && <p role="status" aria-live="polite">{state.message}</p>}
  </div>;
}
