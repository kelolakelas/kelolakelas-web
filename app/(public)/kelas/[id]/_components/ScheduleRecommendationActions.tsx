'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { acceptScheduleRecommendation, declineScheduleRecommendation } from '../_actions/actions';
import type { EnrollmentActionState } from '@/lib/enrollment';

const acceptInitialState: EnrollmentActionState = { success: false, message: '' };
const declineInitialState: EnrollmentActionState = { success: false, message: '' };

/**
 * Confirm control inside the accept dialog (KEL-116).
 *
 * Split out so `useFormStatus` reads the enclosing Server Action form: the
 * button disables itself while the acceptance is in flight.
 */
function AcceptConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 rounded-xl bg-[#617c35] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Menyiapkan pembayaran…' : 'Ya, terima jadwal ini'}
    </button>
  );
}

/**
 * Accept control for a tenant recommendation (KEL-116).
 *
 * The parent confirms in a native `<dialog>` (KEL-109 pattern). Accepting
 * redirects straight to the billing checkout, so a success never renders
 * here — only the in-flight state and a refusal, which keeps the dialog open
 * where the parent is already looking.
 */
export function AcceptRecommendationButton({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(acceptScheduleRecommendation, acceptInitialState);

  return (
    <div>
      <button
        type="button"
        onClick={(event) => {
          const dialog = (event.currentTarget.parentElement as HTMLElement | null)?.querySelector('dialog');
          dialog?.showModal();
        }}
        className="min-h-11 rounded-xl bg-[#617c35] px-4 text-sm font-bold text-white hover:bg-[#4c6329]"
      >
        Terima jadwal ini
      </button>

      <dialog
        aria-labelledby={`accept-recommendation-title-${requestId}`}
        className="max-w-md rounded-3xl border border-[#dfe3d7] bg-white p-6 text-[#17231f] backdrop:bg-black/40"
      >
        <h2 id={`accept-recommendation-title-${requestId}`} className="text-xl font-black">
          Terima jadwal rekomendasi ini?
        </h2>
        <p className="mt-3 text-sm text-[#52615b]">
          Menerima rekomendasi membuat enrollment dan mengarahkan Anda ke pembayaran. Tindakan ini
          tidak dapat diurungkan.
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
          <AcceptConfirmButton />
        </form>

        {!state.success && state.message && (
          <p role="alert" className="mt-4 text-sm text-[#b42318]">
            {state.message}
          </p>
        )}
      </dialog>
    </div>
  );
}

/**
 * Confirm control inside the decline dialog (KEL-116).
 *
 * Split out so `useFormStatus` reads the enclosing Server Action form: the
 * button disables itself while the decline is in flight.
 */
function DeclineConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 rounded-xl bg-[#b42318] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Menolak…' : 'Ya, tolak rekomendasi'}
    </button>
  );
}

/**
 * Decline control for a tenant recommendation (KEL-116).
 *
 * The parent confirms in a native `<dialog>` (KEL-109 pattern). A refusal
 * keeps the dialog open where the parent is already looking; a success
 * closes nothing by itself — the revalidated page re-renders the row as
 * declined, which removes both recommendation controls.
 */
export function DeclineRecommendationButton({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(declineScheduleRecommendation, declineInitialState);

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
        Tolak rekomendasi
      </button>

      <dialog
        aria-labelledby={`decline-recommendation-title-${requestId}`}
        className="max-w-md rounded-3xl border border-[#dfe3d7] bg-white p-6 text-[#17231f] backdrop:bg-black/40"
      >
        <h2 id={`decline-recommendation-title-${requestId}`} className="text-xl font-black">
          Tolak rekomendasi jadwal ini?
        </h2>
        <p className="mt-3 text-sm text-[#52615b]">
          Rekomendasi yang ditolak tidak dapat diterima lagi. Permintaan awal Anda tetap tercatat
          sebagai ditolak. Tindakan ini tidak dapat diurungkan.
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
          <DeclineConfirmButton />
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
