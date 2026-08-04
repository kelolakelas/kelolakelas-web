'use client';

import { useActionState } from 'react';
import { cancelSession } from '../_actions/actions';
import type { SessionActionResponse } from '../_lib/schema';

const initialState: SessionActionResponse = { success: false, message: '' };

export function CancelSessionButton({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(cancelSession, initialState);

  return (
    <div className="space-y-2">
      <form
        action={action}
        onSubmit={(event) => {
          if (!window.confirm('Batalkan session ini? Session yang sudah dibatalkan tidak dapat dipulihkan.')) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="sessionId" value={sessionId} />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50"
        >
          {pending ? 'Membatalkan...' : 'Batalkan session'}
        </button>
      </form>
      {state.message && (
        <p role="status" className={state.success ? 'text-xs text-emerald-700' : 'text-xs text-red-700'}>
          {state.message}
        </p>
      )}
    </div>
  );
}