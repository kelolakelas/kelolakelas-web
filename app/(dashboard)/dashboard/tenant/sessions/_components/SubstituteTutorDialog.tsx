'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { assignSubstituteTutor, type ScheduleActionState } from '../_actions/schedule';
import type { TutorOption } from '../_lib/schema';

const initialActionState: ScheduleActionState = { success: false, message: '' };

/**
 * Submit control inside the substitute-tutor dialog (KEL-138).
 *
 * Split out so `useFormStatus` reads the enclosing Server Action form: the
 * button disables itself while the assignment is in flight.
 */
function SubstituteSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={pending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? 'Menyimpan…' : 'Tugaskan tutor pengganti'}
    </button>
  );
}

/**
 * Substitute-tutor dialog for one session (KEL-138).
 *
 * The member picks the replacement tutor from the tenant's tutor list, then
 * confirms. The select is controlled and named, so it submits itself and
 * survives a refused save: a backend validation error (for example an
 * invalid tutor) is shown in the dialog with the member's choice intact,
 * announced as an alert, while a success is announced as a status. The body
 * always carries `session_id` because the id-addressed route
 * (`PATCH /api/v1/sessions/:id/substitute-tutor`) still requires the
 * session id in the `SubstituteTutorRequest` payload.
 */
export function SubstituteTutorDialog({
  sessionId,
  sessionLabel,
  tutors,
  idPrefix,
}: {
  sessionId: string;
  sessionLabel: string;
  tutors: TutorOption[];
  idPrefix: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [state, formAction] = useActionState(assignSubstituteTutor, initialActionState);
  const [substituteTutorId, setSubstituteTutorId] = useState('');
  const dialogId = `${idPrefix}-substitute-dialog`;
  const titleId = `${idPrefix}-substitute-title`;
  const selectId = `${dialogId}-tutor`;

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
        Tutor pengganti
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
              Tugaskan tutor pengganti
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sessionLabel}</p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Tutup dialog tutor pengganti"
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

          {tutors.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Daftar tutor belum dapat dimuat. Muat ulang halaman lalu coba lagi.
            </p>
          ) : (
            <div>
              <label
                htmlFor={selectId}
                className="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-gray-100"
              >
                Tutor pengganti
              </label>
              <select
                id={selectId}
                name="substitute_tutor_id"
                required
                value={substituteTutorId}
                onChange={(event) => setSubstituteTutorId(event.target.value)}
                className="block w-full min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="">Pilih tutor pengganti</option>
                {tutors.map((tutor) => (
                  <option key={tutor.id} value={tutor.id}>
                    {tutor.email ? `${tutor.name} · ${tutor.email}` : tutor.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/60"
            >
              {state.success ? 'Tutup' : 'Batal'}
            </button>
            <SubstituteSubmitButton disabled={tutors.length === 0 || substituteTutorId === ''} />
          </div>
        </form>
      </dialog>
    </>
  );
}
