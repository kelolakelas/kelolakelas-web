'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  EMPTY_TRANSACTION_REFUND_STATE,
  type TransactionRefundState,
} from '@/lib/transaction-refund';
import { recordTransactionRefund } from '../_actions/refundActions';
import type { TenantTransaction } from '../_lib/transactions';

const initialState: TransactionRefundState = EMPTY_TRANSACTION_REFUND_STATE;

function ConfirmRefundButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Mencatat…' : 'Ya, catat refund'}
    </button>
  );
}

/**
 * Refund control for one paid transaction (KEL-153).
 *
 * Confirmation uses the platform `<dialog>` opened with `showModal()`, as in
 * `DeleteRoleButton`: the native modal traps focus, closes on Escape and is
 * labelled/described for screen readers. Both evidence fields are required —
 * the submit stays disabled while either is blank, and the Server Action
 * rejects blanks again — so a form without a reason or a transfer reference
 * can never be sent.
 *
 * A refusal (400, 404, the 409 "already refunded by another member", or a
 * 503 enrollment-termination failure) keeps the dialog open with the reason.
 * A success closes the dialog; the action has revalidated the transaction
 * list, so the row is re-rendered from the backend as `refunded` and this
 * control disappears with it.
 *
 * Callers only render this control when the row status is `paid` and the
 * member holds `billing:refund`, so a member never sees an action the backend
 * would refuse.
 */
export function RefundTransactionButton({
  transaction,
}: {
  transaction: Pick<TenantTransaction, 'id' | 'merchant_order_id'>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(recordTransactionRefund, initialState);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [transferReference, setTransferReference] = useState('');
  const titleId = `refund-transaction-title-${transaction.id}`;
  const descriptionId = `refund-transaction-description-${transaction.id}`;
  const canSubmit = reason.trim() !== '' && transferReference.trim() !== '';

  useEffect(() => {
    if (state.status === 'success' && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [state]);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setDialogOpen(true);
          dialogRef.current?.showModal();
        }}
        className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:border-red-900/50 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <span>Catat refund</span>
        <span className="sr-only"> untuk transaksi {transaction.merchant_order_id}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => setDialogOpen(false)}
        className="m-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl backdrop:bg-black/50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        <h2 id={titleId} className="text-lg font-bold">
          Catat refund untuk “{transaction.merchant_order_id}”?
        </h2>
        <p id={descriptionId} className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Enrollment terkait transaksi ini akan diakhiri. Tindakan ini tidak dapat diurungkan.
          Isi alasan refund dan referensi transfer sebagai bukti pencatatan manual.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="transaction_id" value={transaction.id} />
          <div>
            <label
              htmlFor={`refund-reason-${transaction.id}`}
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Alasan refund
            </label>
            <textarea
              id={`refund-reason-${transaction.id}`}
              name="reason"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Contoh: kelas dibatalkan atas permintaan parent"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label
              htmlFor={`refund-reference-${transaction.id}`}
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Referensi transfer
            </label>
            <input
              id={`refund-reference-${transaction.id}`}
              name="transfer_reference"
              type="text"
              required
              value={transferReference}
              onChange={(event) => setTransferReference(event.target.value)}
              maxLength={255}
              placeholder="Contoh: TRF-2026-09-27-001"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Batal
            </button>
            <ConfirmRefundButton disabled={!canSubmit} />
          </div>
        </form>

        {dialogOpen && state.status === 'error' && state.message && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
        )}
      </dialog>

      {state.status === 'success' && state.message && (
        <p role="status" className="mt-2 max-w-xs text-xs text-green-700 dark:text-green-400">
          {state.message}
        </p>
      )}
    </div>
  );
}
