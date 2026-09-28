'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { cancelScheduleRequest } from '../_actions/actions';
import type { EnrollmentActionState } from '@/lib/enrollment';

const initialState: EnrollmentActionState = { success: false, message: '' };

/**
 * Cancel control for one pending private schedule request (KEL-109).
 *
 * The parent confirms in a native `<dialog>` (KEL-45 pattern: free focus
 * trapping, Escape-to-cancel, no blocking browser prompt). A refusal keeps the
 * dialog open where the parent is already looking; a success closes it and the
 * revalidated page re-renders the row as cancelled.
 */
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

export function CancelScheduleRequestButton({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(cancelScheduleRequest, initialState);

  return (
    <div>
      <button
        type="button"
        onClick={(event) => {
          const dialog = (event.currentTarget.parentElement as HTMLElement | null)?.querySelector('dialog');
          dialog?.showModal();
        }}
        className="min-h-11 rounded-xl border border-[#f2c6c3] bg-white px-4 text-sm font-bold text-[#b42318] hover:bg-[#fde9e7]"
      >
        Batalkan permintaan
      </button>

      <dialog
        aria-labelledby={`cancel-schedule-request-title-${requestId}`}
        className="max-w-md rounded-3xl border border-[#dfe3d7] bg-white p-6 text-[#17231f] backdrop:bg-black/40"
      >
        <h2 id={`cancel-schedule-request-title-${requestId}`} className="text-xl font-black">
          Batalkan permintaan jadwal ini?
        </h2>
        <p className="mt-3 text-sm text-[#52615b]">
          Permintaan yang dibatalkan tidak lagi ditinjau penyelenggara. Tindakan ini tidak dapat
          diurungkan.
        </p>

        <form action={formAction} className="mt-6 flex flex-wrap justify-end gap-3">
          <input type="hidden" name="request_id" value={requestId} />
          <button
            type="button"
            onClick={(event) => {
              (event.currentTarget.closest('dialog') as HTMLDialogElement | null)?.close();
            }}
            className="min-h-11 rounded-xl border border-[#dfe3d7] bg-white px-4 text-sm font-bold text-[#365047]"
          >
            Tidak jadi
          </button>
          <ConfirmSubmitButton />
        </form>

        {!state.success && state.message && (
          <p role="alert" className="mt-4 text-sm text-[#b42318]">
            {state.message}
          </p>
        )}
      </dialog>

      {state.success && state.message && (
        <p role="status" className="mt-2 max-w-xs text-xs text-[#31551d]">
          {state.message}
        </p>
      )}
    </div>
  );
}
