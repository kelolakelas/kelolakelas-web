'use client';

import { useActionState } from 'react';
import { sendScheduleRequestPaymentLink } from '../_actions/actions';

// Permissions are rechecked by academic and billing for every send, not inferred
// from stale browser claims (same convention as the existing chat entry point).
export function SendPaymentLinkButton({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(sendScheduleRequestPaymentLink, { success: false, message: '' });
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="request_id" value={requestId} />
      <button type="submit" disabled={pending} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
        {pending ? 'Mengirim…' : 'Kirim tautan pembayaran'}
      </button>
      {state.message && <p role={state.success ? 'status' : 'alert'} className="max-w-xs text-xs">{state.message}</p>}
    </form>
  );
}
