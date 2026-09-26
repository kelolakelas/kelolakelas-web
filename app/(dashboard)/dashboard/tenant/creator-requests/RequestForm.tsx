'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestCreator, type CreatorActionState } from './actions';

const initial: CreatorActionState = { status: 0, message: '' };

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded bg-blue-600 px-4 py-3 text-white disabled:opacity-50">{pending ? 'Submitting…' : 'Request Creator'}</button>;
}

export function RequestForm() {
  const [state, action] = useActionState(requestCreator, initial);
  return <form action={action} className="space-y-4 rounded border p-4">
    <h2 className="text-lg font-semibold">Request another Creator</h2>
    <div><label htmlFor="target_email" className="block">Target email</label><input id="target_email" name="target_email" type="email" required maxLength={255} className="w-full rounded border p-2" /></div>
    <div><label htmlFor="reason" className="block">Reason</label><textarea id="reason" name="reason" required maxLength={2000} className="w-full rounded border p-2" /></div>
    <Submit />
    {state.message && <p role="status" aria-live="polite">{state.message}</p>}
  </form>;
}
