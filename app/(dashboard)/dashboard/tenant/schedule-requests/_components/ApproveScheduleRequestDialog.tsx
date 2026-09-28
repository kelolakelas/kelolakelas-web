'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { formatCurrency } from '@/lib/payment-status';
import {
  approveScheduleRequest,
  type ScheduleRequestDecisionState,
} from '../_actions/actions';

const initialState: ScheduleRequestDecisionState = { success: false, message: '' };

/**
 * Confirm control inside the approve dialog (KEL-110).
 *
 * Split out so `useFormStatus` reads the enclosing Server Action form: the
 * button disables itself while the approval is in flight.
 */
function ConfirmSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? 'Menyetujui…' : 'Ya, setujui'}
    </button>
  );
}

/**
 * Payment link block shown after a successful approval (KEL-110).
 *
 * The approve answer carries no expiry field, so no deadline is shown — only
 * the link itself with a copy button. The URL sits in a readonly input as a
 * manual fallback: when the clipboard API is unavailable (non-secure context,
 * denied permission) the member can still select and copy it by hand instead
 * of losing the only copy of the link.
 */
export function ApprovePaymentLink({ url, grossAmount, inputId }: { url: string; grossAmount: number | null; inputId: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyLink() {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('clipboard unavailable');
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-3">
      <label
        htmlFor={inputId}
        className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300"
      >
        Tautan pembayaran
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <input
          id={inputId}
          type="text"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-[44px] w-full flex-1 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          Salin tautan
        </button>
      </div>
      {typeof grossAmount === 'number' && (
        <p className="mt-1.5 text-xs text-emerald-800 dark:text-emerald-300">
          Nominal: {formatCurrency(grossAmount)}
        </p>
      )}
      {copied && (
        <p role="status" className="mt-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          Tautan pembayaran disalin.
        </p>
      )}
      {copyFailed && (
        <p className="mt-1.5 text-xs text-emerald-800 dark:text-emerald-300">
          Penyalinan otomatis gagal. Blokir tautan di atas lalu salin manual.
        </p>
      )}
    </div>
  );
}

/**
 * Approve control for one pending private schedule request (KEL-110).
 *
 * The member confirms in a native `<dialog>` (KEL-109 pattern: free focus
 * trapping, Escape-to-cancel, no blocking browser prompt). A refusal keeps the
 * dialog open where the member is already looking; a success stays open on the
 * payment link block, because the action state is the only place that link
 * exists — closing the dialog would lose it before it can be copied.
 */
export function ApproveScheduleRequestDialog({
  requestId,
  studentName,
  idPrefix,
}: {
  requestId: string;
  studentName: string;
  /** Distinguishes the mobile and desktop copies of the control, which are both in the DOM. */
  idPrefix: string;
}) {
  const [state, formAction] = useActionState(approveScheduleRequest, initialState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const titleId = `${idPrefix}-approve-schedule-request-title-${requestId}`;
  const paymentInputId = `${idPrefix}-approve-payment-link-${requestId}`;

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
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        Setujui
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
          Setujui permintaan jadwal {studentName}?
        </h2>

        {state.success ? (
          <div className="mt-3 space-y-3">
            <p role="status" className="text-sm text-gray-600 dark:text-gray-300">
              {state.message}
            </p>
            {state.paymentUrl && (
              <ApprovePaymentLink url={state.paymentUrl} grossAmount={state.grossAmount ?? null} inputId={paymentInputId} />
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              Permintaan yang disetujui menerbitkan enrollment dan tautan pembayaran untuk
              parent. Tindakan ini tidak dapat diurungkan.
            </p>

            <form action={formAction} className="mt-6 flex flex-wrap justify-end gap-3">
              <input type="hidden" name="request_id" value={requestId} />
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200"
              >
                Tidak jadi
              </button>
              <ConfirmSubmitButton />
            </form>

            {dialogOpen && !state.success && state.message && (
              <p role="alert" className="mt-4 text-sm font-medium text-red-700 dark:text-red-300">
                {state.message}
              </p>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
