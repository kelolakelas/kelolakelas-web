'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  rejectScheduleRequest,
  type ScheduleRequestDecisionState,
} from '../_actions/actions';

const initialState: ScheduleRequestDecisionState = { success: false, message: '' };

/**
 * Confirm control inside the reject dialog (KEL-110).
 *
 * Split out so `useFormStatus` reads the enclosing Server Action form: the
 * button disables itself while the rejection is in flight.
 */
function ConfirmSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? 'Menolak…' : 'Tolak permintaan'}
    </button>
  );
}

/**
 * Reject control for one pending private schedule request (KEL-110).
 *
 * The reason is optional and capped at 2000 characters, matching the backend
 * validation; an empty reason is omitted from the request body rather than
 * sent as an empty string. The member confirms in a native `<dialog>`
 * (KEL-109 pattern). A refusal keeps the dialog open where the member is
 * already looking; a success shows the confirmation inline while the
 * revalidated page behind re-renders the row as rejected.
 */
export function RejectScheduleRequestDialog({
  requestId,
  studentName,
  idPrefix,
}: {
  requestId: string;
  studentName: string;
  /** Distinguishes the mobile and desktop copies of the control, which are both in the DOM. */
  idPrefix: string;
}) {
  const [state, formAction] = useActionState(rejectScheduleRequest, initialState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const titleId = `${idPrefix}-reject-schedule-request-title-${requestId}`;
  const reasonId = `${idPrefix}-reject-schedule-request-reason-${requestId}`;

  function close() {
    dialogRef.current?.close();
  }

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          dialogRef.current?.showModal();
          setDialogOpen(true);
        }}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
      >
        Tolak
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="max-w-md rounded-3xl border border-gray-200 bg-white p-6 text-gray-900 backdrop:bg-black/40 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
        onClose={() => {
          setDialogOpen(false);
          triggerRef.current?.focus();
        }}
      >
        <h2 id={titleId} className="text-xl font-bold">
          Tolak permintaan jadwal {studentName}?
        </h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          Permintaan yang ditolak tidak lagi menunggu keputusan. Tindakan ini tidak dapat
          diurungkan.
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="request_id" value={requestId} />
          <div>
            <label
              htmlFor={reasonId}
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Alasan penolakan (opsional)
            </label>
            <textarea
              id={reasonId}
              name="reason"
              rows={3}
              maxLength={2000}
              placeholder="Contoh: Slot penuh, usulkan hari lain."
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={close}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Tidak jadi
            </button>
            <ConfirmSubmitButton />
          </div>
        </form>

        {dialogOpen && state.message && (
          <p
            role={state.success ? 'status' : 'alert'}
            className={`mt-4 text-sm font-medium ${
              state.success
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-red-700 dark:text-red-300'
            }`}
          >
            {state.message}
          </p>
        )}
      </dialog>
    </div>
  );
}
