'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteTenantReport, type ReportActionState } from '../_actions/reports';

const initialActionState: ReportActionState = { success: false, message: '' };

/** Submit control inside the delete confirmation (KEL-139). */
function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? 'Menghapus…' : 'Hapus laporan'}
    </button>
  );
}

/**
 * Delete confirmation for one report (KEL-139).
 *
 * Only the report identifier is submitted; the Server Action sends no body.
 * A tutor who does not teach the report's class meets the 403 assignment
 * message rather than a technical failure.
 */
export function ReportDeleteDialog({
  reportId,
  reportTitle,
  idPrefix,
}: {
  reportId: string;
  reportTitle: string;
  idPrefix: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [state, formAction] = useActionState(deleteTenantReport, initialActionState);
  const dialogId = `${idPrefix}-report-delete-dialog`;
  const titleId = `${idPrefix}-report-delete-title`;

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  // Return focus to the trigger when the dialog closes so keyboard users do
  // not lose their place in the report list.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const onClose = () => triggerRef.current?.focus();
    dialog.addEventListener('close', onClose);

    return () => dialog.removeEventListener('close', onClose);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-red-300 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        Hapus
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-0 shadow-2xl backdrop:bg-black/50"
      >
        <div className="p-4 sm:p-6">
          <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Hapus laporan ini?
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Laporan “{reportTitle}” akan dihapus permanen dan tidak dapat dikembalikan.
          </p>

          <form action={formAction} className="mt-4 space-y-4">
            <input type="hidden" name="report_id" value={reportId} />

            {state.message && (
              <p
                role={state.success ? 'status' : 'alert'}
                className={`rounded-xl border p-3 text-sm font-medium ${
                  state.success
                    ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                    : 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                }`}
              >
                {state.message}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDialog}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
              >
                {state.success ? 'Tutup' : 'Batal'}
              </button>
              <DeleteSubmitButton />
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
