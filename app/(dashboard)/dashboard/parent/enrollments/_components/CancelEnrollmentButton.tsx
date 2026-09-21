'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { cancelPendingEnrollment } from '../_actions/actions';
import {
  EMPTY_ENROLLMENT_CANCELLATION_STATE,
  type EnrollmentCancellationState,
} from '@/lib/enrollment-cancellation';

/**
 * Cancel control for one pending enrollment (KEL-45).
 *
 * Confirmation uses the platform `<dialog>` element opened with `showModal()`
 * rather than `window.confirm`. The native modal dialog supplies focus
 * trapping, Escape-to-cancel and an inert background for free, and unlike
 * `window.confirm` it can be labelled for assistive technology and does not
 * block the event loop.
 *
 * Two outcomes are presented differently on purpose. A refusal keeps the dialog
 * open with the explanation where the parent is already looking, because the
 * usual reaction is to read it and decide again. A success closes the dialog:
 * the action revalidates the screen, so the row is re-rendered from the backend
 * with the enrollment no longer cancellable, and the confirmation is shown next
 * to where the control used to be.
 *
 * Callers only render this control when `canCancelEnrollment` is true, so the
 * parent never sees an action the backend would refuse with 409.
 */

const initialState: EnrollmentCancellationState = EMPTY_ENROLLMENT_CANCELLATION_STATE;

function ConfirmSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 rounded-xl bg-[#b42318] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Membatalkan…' : 'Ya, batalkan'}
    </button>
  );
}

export function CancelEnrollmentButton({ enrollmentId }: { enrollmentId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(cancelPendingEnrollment, initialState);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (state.status === 'success' && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [state]);

  return (
    <div>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="min-h-11 rounded-xl border border-[#f2c6c3] bg-white px-4 text-sm font-bold text-[#b42318] hover:bg-[#fde9e7]"
      >
        Batalkan pendaftaran
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`cancel-enrollment-title-${enrollmentId}`}
        className="max-w-md rounded-3xl border border-[#dfe3d7] bg-white p-6 text-[#17231f] backdrop:bg-black/40"
        onClose={() => setDialogOpen(false)}
      >
        <h2 id={`cancel-enrollment-title-${enrollmentId}`} className="text-xl font-black">
          Batalkan pendaftaran ini?
        </h2>
        <p className="mt-3 text-sm text-[#52615b]">
          Kursi akan dilepas dan transaksi pending yang terkait akan dibatalkan. Tindakan ini tidak
          dapat diurungkan.
        </p>

        <form action={formAction} className="mt-6 flex flex-wrap justify-end gap-3">
          <input type="hidden" name="enrollment_id" value={enrollmentId} />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-11 rounded-xl border border-[#dfe3d7] bg-white px-4 text-sm font-bold text-[#365047]"
          >
            Tidak jadi
          </button>
          <ConfirmSubmitButton />
        </form>

        {dialogOpen && state.status === 'error' && state.message && (
          <p role="alert" className="mt-4 text-sm text-[#b42318]">
            {state.message}
          </p>
        )}
      </dialog>

      {state.status === 'success' && state.message && (
        <p role="status" className="mt-2 max-w-xs text-xs text-[#31551d]">
          {state.message}
        </p>
      )}
    </div>
  );
}
