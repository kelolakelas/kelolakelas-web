'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { createTenantReport, updateTenantReport, type ReportActionState } from '../_actions/reports';
import {
  reportClassName,
  reportStudentName,
  type ReportEnrollment,
  type TenantReport,
} from '../_lib/schema';

const initialActionState: ReportActionState = { success: false, message: '' };

/**
 * Submit control inside the report form dialog (KEL-139).
 *
 * Split out so `useFormStatus` reads the enclosing Server Action form: the
 * button disables itself while the write is in flight.
 */
function ReportSubmitButton({ mode, disabled = false }: { mode: 'create' | 'update'; disabled?: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={pending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? 'Menyimpan…' : mode === 'create' ? 'Buat laporan' : 'Simpan perubahan'}
    </button>
  );
}

function scoreDefault(report: TenantReport | null): string {
  return typeof report?.score === 'number' && Number.isFinite(report.score) ? String(report.score) : '';
}

/**
 * Create/update dialog for one student evaluation report (KEL-139).
 *
 * The create mode addresses an enrollment chosen from the select; the
 * update mode edits the report's own `title`, `evaluation_notes`, and
 * `score` and never sends an enrollment, because the backend checks the
 * assignment against the stored enrollment. Validation failures from the
 * shared form schema surface as the Server Action message above the form.
 */
export function ReportFormDialog({
  mode,
  report,
  enrollment,
  enrollmentOptions,
  idPrefix,
}: {
  mode: 'create' | 'update';
  report?: TenantReport | null;
  enrollment?: ReportEnrollment | null;
  enrollmentOptions: readonly { enrollment_id: string; label: string }[];
  idPrefix: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [state, formAction] = useActionState(
    mode === 'create' ? createTenantReport : updateTenantReport,
    initialActionState
  );
  const dialogId = `${idPrefix}-report-dialog`;
  const titleId = `${idPrefix}-report-title`;
  const current = mode === 'update' ? (report ?? null) : null;
  const hasEnrollmentOptions = mode === 'update' || enrollmentOptions.length > 0;

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  // Return focus to the trigger when the dialog closes so keyboard users
  // do not lose their place in the report list.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const onClose = () => triggerRef.current?.focus();
    dialog.addEventListener('close', onClose);

    return () => dialog.removeEventListener('close', onClose);
  }, []);

  const subtitle =
    mode === 'create'
      ? 'Tulis laporan evaluasi baru untuk siswa yang Anda ajar.'
      : `${reportStudentName(enrollment?.student ?? current?.enrollment?.student ?? null)} · ${reportClassName(enrollment ?? current?.enrollment ?? null)}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        className={
          mode === 'create'
            ? 'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
            : 'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60'
        }
      >
        {mode === 'create' ? 'Buat laporan' : 'Ubah'}
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-0 shadow-2xl backdrop:bg-black/50"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-800 p-4 sm:p-6">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {mode === 'create' ? 'Buat laporan evaluasi' : 'Ubah laporan evaluasi'}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Tutup dialog laporan"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="space-y-4 p-4 sm:p-6">
          {mode === 'update' && current && <input type="hidden" name="report_id" value={current.id} />}

          {mode === 'create' && (
            <div>
              <label
                htmlFor={`${dialogId}-enrollment`}
                className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                Siswa
              </label>
              <select
                id={`${dialogId}-enrollment`}
                name="enrollment_id"
                defaultValue=""
                required
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100"
              >
                <option value="" disabled>
                  {hasEnrollmentOptions ? 'Pilih siswa' : 'Siswa yang Anda ajar belum ditemukan'}
                </option>
                {enrollmentOptions.map((option) => (
                  <option key={option.enrollment_id} value={option.enrollment_id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {!hasEnrollmentOptions && (
                <p className="mt-1.5 text-sm text-amber-700 dark:text-amber-300" role="status">
                  Daftar siswa yang Anda ajar belum dapat dimuat. Coba muat ulang halaman sebelum membuat laporan.
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor={`${dialogId}-title`}
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Judul laporan
            </label>
            <input
              id={`${dialogId}-title`}
              name="title"
              type="text"
              defaultValue={current?.title ?? ''}
              required
              maxLength={255}
              placeholder="Contoh: Evaluasi tengah semester"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor={`${dialogId}-notes`}
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Catatan evaluasi
            </label>
            <textarea
              id={`${dialogId}-notes`}
              name="evaluation_notes"
              defaultValue={current?.evaluation_notes ?? ''}
              rows={5}
              placeholder="Tuliskan perkembangan, kekuatan, dan area yang perlu ditingkatkan."
              className="mt-1.5 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor={`${dialogId}-score`}
              className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
            >
              Skor (0–100, opsional)
            </label>
            <input
              id={`${dialogId}-score`}
              name="score"
              type="number"
              min={0}
              max={100}
              step="any"
              defaultValue={scoreDefault(current)}
              placeholder="Kosongkan bila belum dinilai"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm text-gray-900 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Skor di luar 0–100 ditolak, seperti halnya judul yang kosong.
            </p>
          </div>

          {state.message && (
            <p
              role={state.success ? 'status' : 'alert'}
              className={`rounded-xl border p-3 text-sm font-medium ${
                state.success
                  ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                  : 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
              }`}
            >
              {state.message}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
            >
              {state.success ? 'Tutup' : 'Batal'}
            </button>
            <ReportSubmitButton mode={mode} disabled={!hasEnrollmentOptions} />
          </div>
        </form>
      </dialog>
    </>
  );
}
