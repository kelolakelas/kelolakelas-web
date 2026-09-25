'use client';
import { useActionState } from 'react';
import { beginFactor, finishFactor } from '../login/actions';
export default function FactorPage() {
  const [start, startAction, starting] = useActionState(beginFactor, { message: '' });
  const [finish, finishAction, finishing] = useActionState(finishFactor, { message: '' });
  return <main className="mx-auto max-w-md p-8"><h1 className="text-2xl font-semibold">Platform second factor</h1>
    <p>Use the code from your authenticator. New enrollment requires an operator to authorize it first.</p>
    <p role="alert">{start.message || finish.message}</p>
    {!start.ready ? <div className="grid gap-4">
      <form action={startAction}><input type="hidden" name="purpose" value="verify"/><button disabled={starting} className="underline">Verify existing factor</button></form>
      <form action={startAction}><input type="hidden" name="purpose" value="enroll"/><button disabled={starting} className="underline">Enroll after operator authorization</button></form>
    </div> : <form action={finishAction} className="grid gap-4">
      {start.secret && <p>Enter this setup key in your authenticator: <code className="break-all">{start.secret}</code>. Do not share it.</p>}
      <label>Six-digit code <input className="border p-2" name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required/></label>
      <button disabled={finishing} className="rounded bg-indigo-600 p-2 text-white">{finishing ? 'Verifying…' : 'Verify'}</button>
    </form>}
    {start.ready && <form action={startAction}><input type="hidden" name="purpose" value={start.purpose}/><button className="underline" disabled={starting}>Start a new challenge</button></form>}
    <a href="/platform/login" className="underline">Sign in again</a>
  </main>;
}
