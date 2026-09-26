'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { requestPasswordReset, type ResetActionState } from '../../reset-password/_actions/actions';

const initialState: ResetActionState = { message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60">{pending ? 'Mengirim...' : 'Kirim tautan reset'}</button>;
}

export function RequestResetForm() {
  const [state, action] = useActionState(requestPasswordReset, initialState);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.message) feedbackRef.current?.focus(); }, [state]);
  return (
    <form action={action} noValidate className="space-y-4">
      {state.message && <p ref={feedbackRef} role="alert" tabIndex={-1} className="text-red-700">{state.message}</p>}
      <div>
        <label htmlFor="reset-email" className="block">Alamat email</label>
        <input id="reset-email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state.errors?.email)} aria-describedby={state.errors?.email ? 'reset-email-error' : undefined} className="w-full rounded border p-2 focus-visible:outline-2 focus-visible:outline-indigo-600" />
        {state.errors?.email && <p id="reset-email-error" role="alert" className="text-red-700">{state.errors.email[0]}</p>}
      </div>
      <SubmitButton />
    </form>
  );
}
