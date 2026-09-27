'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { decideCreatorRequest } from './actions';
import type { CreatorActionState } from '@/app/(dashboard)/dashboard/tenant/creator-requests/actions';

const initial: CreatorActionState = { status: 0, message: '' };

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded bg-blue-600 px-4 py-3 text-white disabled:opacity-50">{pending ? 'Saving…' : 'Confirm decision'}</button>;
}

export function DecisionForm({ id, email }: { id: string; email: string }) {
  const [state, action] = useActionState(decideCreatorRequest, initial);
  const [decision, setDecision] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state.status === 200 && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [state.status]);

  return <div className="space-y-3 rounded border p-4">
    <p>Target: {email}</p>
    <button
      ref={triggerRef}
      type="button"
      onClick={() => dialogRef.current?.showModal()}
      className="rounded bg-blue-600 px-4 py-3 text-white"
    >
      Review decision
    </button>
    <dialog
      ref={dialogRef}
      aria-labelledby={`creator-decision-title-${id}`}
      onClose={() => triggerRef.current?.focus()}
      className="max-w-md rounded border bg-white p-6"
    >
      <h2 id={`creator-decision-title-${id}`} className="text-lg font-bold">Confirm decision for {email}?</h2>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={id} />
        <div><label htmlFor={`decision-${id}`} className="block">Decision</label><select id={`decision-${id}`} name="decision" required value={decision} onChange={(event) => setDecision(event.target.value)} className="rounded border p-2"><option value="">Select decision</option><option value="approve">Approve</option><option value="reject">Reject</option></select></div>
        <div><label htmlFor={`reason-${id}`} className="block">Rejection reason (required for rejection)</label><textarea id={`reason-${id}`} name="reason" required={decision === 'reject'} maxLength={2000} className="w-full rounded border p-2" /></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => dialogRef.current?.close()} className="rounded border px-4 py-3">Cancel</button>
          <Submit />
        </div>
        {state.message && <p role="status" aria-live="polite">{state.message}</p>}
      </form>
    </dialog>
  </div>;
}
