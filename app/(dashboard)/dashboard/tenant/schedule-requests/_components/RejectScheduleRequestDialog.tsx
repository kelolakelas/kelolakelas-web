'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { WEEKDAY_NAMES } from '@/lib/enrollment-schedule';
import {
  validateScheduleSlotDrafts,
  type ScheduleSlotDraft,
} from '@/lib/schedule-request';
import {
  rejectScheduleRequest,
  type ScheduleRequestDecisionState,
} from '../_actions/actions';

const initialState: ScheduleRequestDecisionState = { success: false, message: '' };

/**
 * Confirm control inside the reject dialog (KEL-110, extended KEL-116).
 *
 * Split out so `useFormStatus` reads the enclosing Server Action form: the
 * button disables itself while the rejection is in flight.
 */
function ConfirmSubmitButton({ withRecommendation }: { withRecommendation: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? 'Menolak…' : withRecommendation ? 'Tolak dengan rekomendasi' : 'Tolak permintaan'}
    </button>
  );
}

/**
 * Reject control for one pending private schedule request (KEL-110, extended
 * KEL-116 with a recommendation mode).
 *
 * The member picks "Tolak" for a plain rejection or "Tolak dengan rekomendasi
 * jadwal" to attach one or more alternative slots (day, start, end) plus an
 * optional reason. Slot inputs follow the KEL-109 request form: rows can be
 * added and removed, and a slot whose end is not after its start is rejected
 * in the form before anything is sent (client pre-check via
 * `validateScheduleSlotDrafts`, mirrored by the server-side schema). The
 * member confirms in a native `<dialog>` (KEL-109 pattern). A refusal keeps
 * the dialog open where the member is already looking; a success shows the
 * confirmation inline while the revalidated page behind re-renders the row
 * as rejected.
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
  const [withRecommendation, setWithRecommendation] = useState(false);
  const [drafts, setDrafts] = useState<ScheduleSlotDraft[]>([{ day_of_week: '1', start_time: '', end_time: '' }]);
  const [clientError, setClientError] = useState<string | null>(null);
  const titleId = `${idPrefix}-reject-schedule-request-title-${requestId}`;
  const reasonId = `${idPrefix}-reject-schedule-request-reason-${requestId}`;
  const modePlainId = `${idPrefix}-reject-schedule-request-mode-plain-${requestId}`;
  const modeRecommendId = `${idPrefix}-reject-schedule-request-mode-recommend-${requestId}`;

  function close() {
    dialogRef.current?.close();
  }

  function updateDraft(index: number, patch: Partial<ScheduleSlotDraft>) {
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  const slotPayload = JSON.stringify(
    drafts.map((draft) => ({
      day_of_week: Number(draft.day_of_week),
      start_time: draft.start_time,
      end_time: draft.end_time,
    }))
  );

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

        <form
          action={formAction}
          onSubmit={(event) => {
            if (!withRecommendation) {
              setClientError(null);
              return;
            }
            const error = validateScheduleSlotDrafts(drafts);
            if (error) {
              event.preventDefault();
              setClientError(error);
              return;
            }
            setClientError(null);
          }}
          className="mt-4 space-y-4"
        >
          <input type="hidden" name="request_id" value={requestId} />
          {withRecommendation && <input type="hidden" name="slots" value={slotPayload} />}
          <fieldset>
            <legend className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Jenis penolakan
            </legend>
            <div className="mt-1.5 space-y-2">
              <label htmlFor={modePlainId} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                <input
                  id={modePlainId}
                  type="radio"
                  name="reject_mode"
                  checked={!withRecommendation}
                  onChange={() => setWithRecommendation(false)}
                  className="h-4 w-4 accent-red-600"
                />
                Tolak
              </label>
              <label htmlFor={modeRecommendId} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                <input
                  id={modeRecommendId}
                  type="radio"
                  name="reject_mode"
                  checked={withRecommendation}
                  onChange={() => setWithRecommendation(true)}
                  className="h-4 w-4 accent-red-600"
                />
                Tolak dengan rekomendasi jadwal
              </label>
            </div>
          </fieldset>
          {withRecommendation && (
            <fieldset>
              <legend className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Slot rekomendasi
              </legend>
              <div className="mt-1.5 space-y-3">
                {drafts.map((draft, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor={`${idPrefix}-reject-recommend-day-${index}-${requestId}`}
                          className="text-xs font-bold"
                        >
                          Hari
                        </label>
                        <select
                          id={`${idPrefix}-reject-recommend-day-${index}-${requestId}`}
                          value={draft.day_of_week}
                          onChange={(event) => updateDraft(index, { day_of_week: event.target.value })}
                          className="mt-1 min-h-[44px] w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm"
                        >
                          {WEEKDAY_NAMES.map((name, dayIndex) => (
                            <option value={String(dayIndex + 1)} key={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor={`${idPrefix}-reject-recommend-start-${index}-${requestId}`}
                          className="text-xs font-bold"
                        >
                          Jam mulai
                        </label>
                        <input
                          id={`${idPrefix}-reject-recommend-start-${index}-${requestId}`}
                          type="time"
                          value={draft.start_time}
                          onChange={(event) => updateDraft(index, { start_time: event.target.value })}
                          required={withRecommendation}
                          className="mt-1 min-h-[44px] w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`${idPrefix}-reject-recommend-end-${index}-${requestId}`}
                          className="text-xs font-bold"
                        >
                          Jam selesai
                        </label>
                        <input
                          id={`${idPrefix}-reject-recommend-end-${index}-${requestId}`}
                          type="time"
                          value={draft.end_time}
                          onChange={(event) => updateDraft(index, { end_time: event.target.value })}
                          required={withRecommendation}
                          className="mt-1 min-h-[44px] w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm"
                        />
                      </div>
                    </div>
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                        className="mt-2 text-xs font-bold text-red-700 dark:text-red-300 hover:underline"
                      >
                        Hapus slot ini
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDrafts((current) => [...current, { day_of_week: '1', start_time: '', end_time: '' }])}
                className="mt-2 inline-flex min-h-[44px] items-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200"
              >
                Tambah slot
              </button>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Jam selesai harus setelah jam mulai pada setiap slot.
              </p>
            </fieldset>
          )}
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
          {clientError && (
            <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
              {clientError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={close}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Tidak jadi
            </button>
            <ConfirmSubmitButton withRecommendation={withRecommendation} />
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
