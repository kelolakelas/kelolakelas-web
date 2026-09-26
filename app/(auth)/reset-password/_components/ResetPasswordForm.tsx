'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { confirmPasswordReset, type ResetActionState } from '../_actions/actions';

const initialState: ResetActionState = { message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60">{pending ? 'Menyimpan...' : 'Simpan password baru'}</button>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(confirmPasswordReset, initialState);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.message) feedbackRef.current?.focus(); }, [state]);
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.message && <p ref={feedbackRef} role="alert" className="text-red-700" tabIndex={-1}>{state.message}</p>}
      {state.invalidToken ? <a href="/forgot-password" className="text-indigo-700 underline focus-visible:outline-2">Minta tautan baru</a> : (
        <>
          <div>
            <label htmlFor="new-password" className="block">Password baru</label>
            <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={6} required aria-invalid={Boolean(state.errors?.password)} aria-describedby={state.errors?.password ? 'password-error' : undefined} className="w-full rounded border p-2 focus-visible:outline-2 focus-visible:outline-indigo-600" />
            {state.errors?.password && <p id="password-error" role="alert" className="text-red-700">{state.errors.password[0]}</p>}
          </div>
          <div>
            <label htmlFor="confirm-password" className="block">Konfirmasi password baru</label>
            <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={Boolean(state.errors?.confirmPassword)} aria-describedby={state.errors?.confirmPassword ? 'confirm-error' : undefined} className="w-full rounded border p-2 focus-visible:outline-2 focus-visible:outline-indigo-600" />
            {state.errors?.confirmPassword && <p id="confirm-error" role="alert" className="text-red-700">{state.errors.confirmPassword[0]}</p>}
          </div>
          <SubmitButton />
        </>
      )}
    </form>
  );
}
