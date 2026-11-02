'use client';

import { notifyScheduleRequestCountChanged } from '@/lib/schedule-request-count-events';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/payment-status';
import { scheduleSlotLabel, type ScheduleRequestSlot } from '@/lib/schedule-request';
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
function ConfirmSubmitButton({ recovery = false, invalid = false }: { recovery?: boolean; invalid?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || invalid}
      aria-busy={pending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? 'Memproses…' : recovery ? 'Lihat/pulihkan pembayaran' : 'Ya, setujui'}
    </button>
  );
}

function SlotSelection({ slots, selected, setSelected, limit, locked }: {
  slots: ScheduleRequestSlot[];
  selected: number[];
  setSelected: (indexes: number[]) => void;
  limit: number | null | undefined;
  locked: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending || locked} className="w-full space-y-3 rounded-xl border border-gray-300 p-4 dark:border-gray-700">
      <legend className="px-2 text-sm font-semibold">Pilih jadwal yang disetujui</legend>
      {slots.map((slot, index) => (
        <label key={index} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
          <input type={limit === 1 ? 'radio' : 'checkbox'} name="slot_choice" value={index}
            checked={selected.includes(index)}
            ref={input => { if (input) input.defaultChecked = selected.includes(index); }}
            disabled={limit !== 1 && limit != null && selected.length >= limit && !selected.includes(index)}
            onChange={() => setSelected(limit === 1 ? [index] : selected.includes(index) ? selected.filter(value => value !== index) : [...selected, index].sort((left, right) => left - right))}
            className="size-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600" />
          {scheduleSlotLabel(slot)}
        </label>
      ))}
      <p role="status" className="text-sm">{selected.length} slot dipilih{limit != null ? ` dari maksimum ${limit}` : ' (legacy tanpa batas)'}. Harga kelas tetap.</p>
      {selected.length > 0 && <p className="text-sm font-medium">Akan disetujui: {selected.map(index => scheduleSlotLabel(slots[index])).join('; ')}</p>}
      {locked && <p className="text-sm">Keputusan sudah tersimpan; pemulihan memakai jadwal yang sama.</p>}
    </fieldset>
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
  recovery = false,
  privateSlotLimit,
  slots = [],
  approvedSlots,
}: {
  requestId: string;
  studentName: string;
  /** Distinguishes the mobile and desktop copies of the control, which are both in the DOM. */
  idPrefix: string;
  recovery?: boolean;
  privateSlotLimit?: number | null;
  slots?: ScheduleRequestSlot[];
  approvedSlots?: ScheduleRequestSlot[];
}) {
  const [state, formAction] = useActionState(approveScheduleRequest, initialState);
  useEffect(() => {
    if (state.success) notifyScheduleRequestCountChanged();
  }, [state]);
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>(() => slots.flatMap((slot, index) => approvedSlots?.some(approved => approved.day_of_week === slot.day_of_week && approved.start_time === slot.start_time && approved.end_time === slot.end_time) ? [index] : []));
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
        {recovery ? 'Lihat/pulihkan pembayaran' : 'Setujui'}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="max-w-md rounded-3xl border border-gray-200 bg-white p-6 text-gray-900 backdrop:bg-black/40 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
        onClose={() => {
          setDialogOpen(false);
          triggerRef.current?.focus();
          if (state.success) router.refresh();
        }}
      >
        <h2 id={titleId} className="text-xl font-bold">
          {recovery ? `Lihat/pulihkan pembayaran ${studentName}?` : `Setujui permintaan jadwal ${studentName}?`}
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
              {recovery
                ? 'Ambil kembali pembayaran dari permintaan yang sama. Jika penerbitan invoice sebelumnya gagal, proses akan dilanjutkan tanpa membuat enrollment atau jadwal baru. Invoice aktif tetap digunakan.'
                : 'Permintaan yang disetujui menerbitkan enrollment dan tautan pembayaran untuk parent. Tindakan ini tidak dapat diurungkan.'}
            </p>

            {!recovery && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Pilih minimal satu usulan. Hanya jadwal terpilih menjadi jadwal belajar. Server memeriksa kembali usulan dan batas terbaru; jika berubah, muat ulang halaman.</p>}
            <form action={formAction} className="mt-6 flex flex-wrap justify-end gap-3">
              <input type="hidden" name="request_id" value={requestId} />
              {!recovery && <>
                <input type="hidden" name="proposal_snapshot" value={JSON.stringify(slots)} />
                <input type="hidden" name="expected_private_slot_limit" value={JSON.stringify(privateSlotLimit ?? null)} />
                {selected.map(index => <input key={index} type="hidden" name="selected_slot_indexes" value={index} />)}
                <SlotSelection slots={slots} selected={selected} setSelected={setSelected} limit={privateSlotLimit} locked={!!approvedSlots?.length} />
              </>}
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200"
              >
                Tidak jadi
              </button>
              <ConfirmSubmitButton recovery={recovery} invalid={!recovery && (selected.length === 0 || (!approvedSlots?.length && privateSlotLimit != null && selected.length > privateSlotLimit))} />
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
