'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { rescheduleSession, type ScheduleActionState } from '../_actions/schedule';

const initialActionState: ScheduleActionState = { success: false, message: '' };

/**
 * Submit control inside the reschedule dialog (KEL-138).
 *
 * Split out so `useFormStatus` reads the enclosing Server Action form: the
 * button disables itself while the reschedule is in flight.
 */
function RescheduleSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? 'Menyimpan…' : 'Simpan reschedule'}
    </button>
  );
}

/**
 * Reschedule dialog for one session (KEL-138).
 *
 * The member picks the new date and time window, then confirms. The inputs
 * are controlled and named, so they submit themselves and survive a refused
 * save: a backend validation error is shown in the dialog with the member's
 * input intact, announced as an alert, while a success is announced as a
 * status. The body always carries `session_id` because the id-addressed
 * route (`POST /api/v1/sessions/:id/reschedule`) still requires the session
 * id in the `RescheduleSessionRequest` payload.
 */
export function RescheduleDialog({
  sessionId,
  sessionLabel,
  idPrefix,
}: {
  sessionId: string;
  sessionLabel: string;
  idPrefix: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [state, formAction] = useActionState(rescheduleSession, initialActionState);
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const dialogId = `${idPrefix}-reschedule-dialog`;
  const titleId = `${idPrefix}-reschedule-title`;

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  // Return focus to the trigger when the dialog closes so keyboard users do
  // not lose their place in the session list.
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
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-blue-600 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-xs transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-blue-500 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
      >
        Reschedule
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-4 sm:p-6 dark:border-gray-800">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Reschedule sesi
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sessionLabel}</p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Tutup dialog reschedule"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="space-y-4 p-4 sm:p-6">
          <input type="hidden" name="session_id" value={sessionId} />

          {state.message && (
            <p
              role={state.success ? 'status' : 'alert'}
              className={`rounded-xl border p-3 text-sm font-medium ${
                state.success
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
              }`}
            >
              {state.message}
            </p>
          )}

          <div>
            <label
              htmlFor={`${dialogId}-date`}
              className="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              Tanggal baru
            </label>
            <input
              id={`${dialogId}-date`}
              name="new_session_date"
              type="date"
              required
              value={newSessionDate}
              onChange={(event) => setNewSessionDate(event.target.value)}
              className="block w-full min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${dialogId}-start`}
                className="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                Jam mulai baru
              </label>
              <input
                id={`${dialogId}-start`}
                name="new_start_time"
                type="time"
                required
                value={newStartTime}
                onChange={(event) => setNewStartTime(event.target.value)}
                className="block w-full min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor={`${dialogId}-end`}
                className="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                Jam selesai baru
              </label>
              <input
                id={`${dialogId}-end`}
                name="new_end_time"
                type="time"
                required
                value={newEndTime}
                onChange={(event) => setNewEndTime(event.target.value)}
                className="block w-full min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/60"
            >
              {state.success ? 'Tutup' : 'Batal'}
            </button>
            <RescheduleSubmitButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
