'use client';

import { LoaderCircle, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResponse } from '../_actions/classActions';

type PublishAction = (previousState: ActionResponse, formData: FormData) => Promise<ActionResponse>;
const initialState: ActionResponse = { success: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Publishing...' : <><Upload className="h-4 w-4" aria-hidden="true" /> Publish</>}
    </button>
  );
}

export function PublishActionButton({ id, action }: { id: string; action: PublishAction }) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton />
      </form>
      {state.message && (
        <p role={state.success ? 'status' : 'alert'} className={`max-w-48 text-xs ${state.success ? 'text-emerald-700' : 'text-red-600'}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}