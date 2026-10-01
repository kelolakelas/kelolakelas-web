'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  saveSessionAttendance,
  type SaveSessionAttendanceState,
} from '../_actions/attendance';
import {
  ATTENDANCE_STATUS_OPTIONS,
  attendanceStatusLabel,
  sessionAttendeeName,
  type AttendanceStatus,
  type SessionAttendee,
  type SessionAttendanceRecord,
} from '../_lib/schema';

const initialActionState: SaveSessionAttendanceState = {
  success: false,
  message: '',
  results: [],
  forbidden: false,
};

/**
 * Submit control inside the attendance dialog (KEL-137).
 *
 * Split out so `useFormStatus` reads the enclosing Server Action form: the
 * button disables itself while the mass save is in flight.
 */
function SaveSubmitButton({ attendeeCount }: { attendeeCount: number }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? 'Menyimpan…' : `Simpan kehadiran ${attendeeCount} siswa`}
    </button>
  );
}

/**
 * Radio group recording one attendee's status (KEL-137).
 *
 * Each attendee is a `fieldset` with the student name as its `legend`, so a
 * screen reader announces whose status the four radios set. The radios are
 * native inputs: Tab moves between groups, arrow keys move within a group,
 * and the checked status is exposed through the native radio semantics —
 * no custom key handling to get wrong.
 */
function AttendeeStatusField({
  attendee,
  value,
  savedStatus,
  rowMessage,
  onChange,
}: {
  attendee: SessionAttendee;
  value: AttendanceStatus;
  savedStatus: string | null;
  rowMessage: string | null;
  onChange: (status: AttendanceStatus) => void;
}) {
  const name = `status-${attendee.enrollment_id}`;
  const savedLabel = savedStatus ? attendanceStatusLabel(savedStatus) : null;

  return (
    <fieldset className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5">
      <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {sessionAttendeeName(attendee.student)}
      </legend>
      {savedLabel && (
        <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">
          Tercatat: <span className="font-semibold">{savedLabel}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-2" role="presentation">
        {ATTENDANCE_STATUS_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="h-4 w-4 accent-blue-600"
            />
            {option.label}
          </label>
        ))}
      </div>
      {rowMessage && (
        <p role="status" className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          {rowMessage}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Mass attendance dialog for one session (KEL-137).
 *
 * The tutor reviews every attendee — unrecorded rows start at Hadir and any
 * row can be changed — then saves the whole session at once. The entries are
 * serialised to the hidden `entries` field on every render, so the Server
 * Action receives exactly what the radios show. After the save the dialog
 * reports the per-row outcome: saved rows appear on refresh through the
 * read-back, already-recorded rows (a repeated save answers `409`) read as
 * recorded rather than failed, and only the failed rows need another
 * attempt.
 */
export function AttendanceDialog({
  sessionId,
  sessionLabel,
  attendees,
  attendance,
  idPrefix,
}: {
  sessionId: string;
  sessionLabel: string;
  attendees: SessionAttendee[];
  attendance: Map<string, SessionAttendanceRecord>;
  idPrefix: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [state, formAction] = useActionState(saveSessionAttendance, initialActionState);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const dialogId = `${idPrefix}-attendance-dialog`;
  const titleId = `${idPrefix}-attendance-title`;

  const statusFor = (enrollmentId: string): AttendanceStatus =>
    statuses[enrollmentId] ?? 'present';

  function openDialog() {
    setStatuses((current) => {
      const next = { ...current };

      for (const attendee of attendees) {
        if (!next[attendee.enrollment_id]) {
          const saved = attendance.get(attendee.enrollment_id)?.status;
          next[attendee.enrollment_id] =
            saved === 'present' || saved === 'late' || saved === 'excused' || saved === 'absent'
              ? saved
              : 'present';
        }
      }

      return next;
    });
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

  const entries = attendees.map((attendee) => ({
    enrollment_id: attendee.enrollment_id,
    status: statusFor(attendee.enrollment_id),
  }));

  const resultsByEnrollment = new Map(state.results.map((result) => [result.enrollmentId, result]));
  const showForbidden = state.forbidden;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        Catat kehadiran
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
              Catat kehadiran
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sessionLabel}</p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Tutup dialog kehadiran"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="space-y-4 p-4 sm:p-6">
          <input type="hidden" name="session_id" value={sessionId} />
          <input type="hidden" name="entries" value={JSON.stringify(entries)} />

          {showForbidden ? (
            <section
              role="alert"
              className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 sm:p-6"
            >
              <p className="text-xs font-bold uppercase tracking-[.16em] text-amber-700 dark:text-amber-400">
                Akses ditolak
              </p>
              <h3 className="mt-2 text-base font-bold text-gray-900 dark:text-gray-100">
                Anda tidak memiliki akses mencatat kehadiran.
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{state.message}</p>
            </section>
          ) : (
            <>
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

              <div className="space-y-3">
                {attendees.map((attendee) => (
                  <AttendeeStatusField
                    key={attendee.enrollment_id}
                    attendee={attendee}
                    value={statusFor(attendee.enrollment_id)}
                    savedStatus={attendance.get(attendee.enrollment_id)?.status ?? null}
                    rowMessage={resultsByEnrollment.get(attendee.enrollment_id)?.message ?? null}
                    onChange={(status) =>
                      setStatuses((current) => ({ ...current, [attendee.enrollment_id]: status }))
                    }
                  />
                ))}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/60"
                >
                  {state.success ? 'Tutup' : 'Batal'}
                </button>
                <SaveSubmitButton attendeeCount={attendees.length} />
              </div>
            </>
          )}
        </form>
      </dialog>
    </>
  );
}
