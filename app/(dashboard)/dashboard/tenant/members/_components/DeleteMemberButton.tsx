'use client';

import { LoaderCircle, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteTenantMember, type ActionResponse } from '../_actions/actions';

const initialState: ActionResponse = { success: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Menghapus...' : 'Hapus member'}
    </button>
  );
}

export function DeleteMemberButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(deleteTenantMember, initialState);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!state.message) return;
    if (state.success) {
      dialogRef.current?.close();
      const toastTimer = window.setTimeout(() => setToast(state.message), 0);
      const refreshTimer = window.setTimeout(() => router.refresh(), 700);
      const clearToastTimer = window.setTimeout(() => setToast(''), 3500);
      return () => {
        window.clearTimeout(toastTimer);
        window.clearTimeout(refreshTimer);
        window.clearTimeout(clearToastTimer);
      };
    }
  }, [router, state]);

  return (
    <>
      <button
        type="button"
        onClick={() => !pending && dialogRef.current?.showModal()}
        disabled={pending}
        title={`Hapus ${memberName}`}
        aria-label={`Hapus ${memberName}`}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-gray-950/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Hapus member?</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {memberName} akan dihapus dari tenant ini.
              </p>
            </div>
            <button
              type="button"
              onClick={() => !pending && dialogRef.current?.close()}
              disabled={pending}
              aria-label="Tutup dialog"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <form action={formAction} className="mt-6 space-y-4">
            <input type="hidden" name="member_id" value={memberId} />
            {state.message && !state.success && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                {state.message}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => !pending && dialogRef.current?.close()}
                disabled={pending}
                className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Batal
              </button>
              <SubmitButton />
            </div>
          </form>
        </div>
      </dialog>
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-4 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg sm:left-auto sm:w-auto">
          {toast}
        </div>
      )}
    </>
  );
}