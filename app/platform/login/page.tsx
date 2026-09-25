'use client';
import { useActionState } from 'react';
import { platformLogin } from './actions';
export default function PlatformLogin() {
  const [state, action, pending] = useActionState(platformLogin, { message: '' });
  return <main className="mx-auto max-w-md p-8"><h1 className="text-2xl font-semibold">Platform admin sign in</h1>
    <p role="alert">{state.message}</p><form action={action} className="grid gap-4">
      <label>Email <input className="border p-2" name="email" type="email" autoComplete="username" required /></label>
      <label>Password <input className="border p-2" name="password" type="password" autoComplete="current-password" required /></label>
      <button className="rounded bg-indigo-600 p-2 text-white" disabled={pending}>Continue</button>
    </form></main>;
}
