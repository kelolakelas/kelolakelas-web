'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { acceptExistingInvitation, signInForInvitation, type InvitationActionState } from '../_actions/actions';

export function ExistingInvitationForm({ token, signedIn }: { token: string; signedIn: boolean }) {
  const [state, action, pending] = useActionState(acceptExistingInvitation, { success: false, message: '' } as InvitationActionState);
  return <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl sm:p-8">
    <h2 className="text-lg font-semibold text-gray-900">Terima dengan akun Teacher</h2>
    <p className="mt-2 text-sm text-gray-600">Masuk dengan email undangan. Akun, kata sandi, wallet, dan membership lama tetap digunakan.</p>
    {state.message && <p role={state.success ? 'status' : 'alert'} className="my-4 text-sm text-gray-800">{state.message}</p>}
    {state.success ? <Link className="mt-4 inline-block text-indigo-700 underline" href="/dashboard/tenant">Buka dashboard dan pilih tenant</Link> : <>
      {signedIn && !state.redirectTo && <form action={action} className="mt-4">
        <input type="hidden" name="token" value={token} />
        <button disabled={pending} className="min-h-11 w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">{pending ? 'Menerima undangan…' : 'Terima undangan'}</button>
      </form>}
      <form action={signInForInvitation} className="mt-4">
        <input type="hidden" name="token" value={token} />
        <button disabled={pending} className="min-h-11 text-sm text-indigo-700 underline focus-visible:outline-2 focus-visible:outline-offset-2">{signedIn ? 'Masuk dengan akun undangan lain' : 'Masuk untuk menerima undangan'}</button>
      </form>
    </>}
  </div>;
}
