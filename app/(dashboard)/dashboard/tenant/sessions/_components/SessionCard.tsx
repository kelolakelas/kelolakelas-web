import {
  attendanceStatusLabel,
  sessionAttendeeName,
  sessionClassName,
  sessionDateLabel,
  sessionStatusLabel,
  sessionTimeLabel,
  type TutorOption,
} from '../_lib/schema';
import type { TutorSessionRow } from '../_queries/queries';
import { AttendanceDialog } from './AttendanceDialog';
import { RescheduleDialog } from './RescheduleDialog';
import { SubstituteTutorDialog } from './SubstituteTutorDialog';

/** Badge colours for the session lifecycle status. */
const SESSION_STATUS_TONES: Record<string, string> = {
  scheduled: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  rescheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  completed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function SessionStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
        SESSION_STATUS_TONES[status] ??
        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      {sessionStatusLabel(status)}
    </span>
  );
}

/**
 * Empty state shown when a session has no attendees to record.
 *
 * A session legitimately has no attendees when nobody is enrolled on its
 * schedule yet, so the state explains that instead of reporting an error —
 * and no attendance dialog is offered because there is nothing to save.
 */
function NoAttendeesState() {
  return (
    <p className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
      Belum ada siswa pada sesi ini, sehingga belum ada kehadiran yang dapat dicatat.
    </p>
  );
}

/**
 * Fallback shown instead of the attendance dialog when the member lacks
 * `attendance:create` (KEL-137).
 *
 * The backend stays the access authority — the action refuses the save with
 * the same permission — this panel only decides what the dashboard offers,
 * so the member is told about the missing permission instead of meeting a
 * technical error after submitting.
 */
function AttendanceForbiddenPanel() {
  return (
    <section
      role="alert"
      aria-label="Akses mencatat kehadiran ditolak"
      className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-3 text-sm text-amber-900 dark:text-amber-200"
    >
      Anda tidak memiliki izin mencatat kehadiran. Hubungi administrator tenant untuk mendapatkan
      permission attendance:create.
    </section>
  );
}

/**
 * Fallback shown instead of the schedule dialogs when the member lacks
 * `schedule:update` (KEL-138).
 *
 * The backend stays the access authority — the actions refuse the mutation
 * with the same permission — this panel only decides what the dashboard
 * offers, so the member is told about the missing permission instead of
 * meeting a technical error after submitting.
 */
function ScheduleForbiddenPanel() {
  return (
    <section
      role="alert"
      aria-label="Akses mengubah sesi ditolak"
      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
    >
      Anda tidak memiliki izin mengubah sesi. Hubungi administrator tenant untuk mendapatkan
      permission schedule:update.
    </section>
  );
}

/**
 * One tutor session with its attendees and the mass attendance dialog
 * (KEL-137).
 *
 * The card is a Server Component: the dialogs it embeds are the only
 * interactive parts. The recorded states come from the read-back, so what
 * the tutor sees after a refresh is what the backend stored — including the
 * replacement rows of rescheduled sessions, which the session_id-addressed
 * write reaches (KEL-134).
 *
 * The reschedule and substitute-tutor dialogs (KEL-138) are offered only to
 * members with `schedule:update`: the backend stays the access authority and
 * refuses the mutation with the same permission. Cancelled sessions offer
 * neither dialog — the backend answers the mutation with a conflict — but
 * explain why inline instead of failing silently.
 */
export function SessionCard({
  row,
  canRecordAttendance,
  canManageSessions,
  tutors,
  idPrefix,
}: {
  row: TutorSessionRow;
  canRecordAttendance: boolean;
  canManageSessions: boolean;
  tutors: TutorOption[];
  idPrefix: string;
}) {
  const { session, attendees, attendance, attendanceForbidden } = row;
  const sessionLabel = `${sessionDateLabel(session.session_date)} · ${sessionTimeLabel(session.start_time, session.end_time)}`;
  const isCancelled = session.status === 'cancelled';

  return (
    <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
            {sessionClassName(session)}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {sessionDateLabel(session.session_date)} · {sessionTimeLabel(session.start_time, session.end_time)}
          </p>
        </div>
        <SessionStatusBadge status={session.status} />
      </div>

      <ul className="mt-4 space-y-2" aria-label={`Siswa pada ${sessionClassName(session)}`}>
        {attendees.map((attendee) => {
          const saved = attendance.get(attendee.enrollment_id);

          return (
            <li
              key={attendee.enrollment_id}
              className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {sessionAttendeeName(attendee.student)}
              </span>
              {attendanceForbidden ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Status tidak tersedia untuk role Anda
                </span>
              ) : saved ? (
                <span
                  aria-label={`Status kehadiran: ${attendanceStatusLabel(saved.status)}`}
                  className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300"
                >
                  {attendanceStatusLabel(saved.status)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                  Belum dicatat
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {attendees.length === 0 && (
        <div className="mt-4">
          <NoAttendeesState />
        </div>
      )}

      {attendanceForbidden && attendees.length > 0 && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Status kehadiran hanya dapat dilihat oleh role dengan izin attendance:read.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {attendees.length > 0 &&
          (canRecordAttendance ? (
            <AttendanceDialog
              sessionId={session.id}
              sessionLabel={sessionLabel}
              attendees={attendees}
              attendance={attendance}
              idPrefix={idPrefix}
            />
          ) : (
            <AttendanceForbiddenPanel />
          ))}

        {isCancelled ? (
          <p className="rounded-xl border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Sesi ini dibatalkan sehingga tidak dapat di-reschedule atau diberi tutor pengganti.
          </p>
        ) : canManageSessions ? (
          <div className="flex flex-wrap gap-3">
            <RescheduleDialog sessionId={session.id} sessionLabel={sessionLabel} idPrefix={idPrefix} />
            <SubstituteTutorDialog
              sessionId={session.id}
              sessionLabel={sessionLabel}
              tutors={tutors}
              idPrefix={idPrefix}
            />
          </div>
        ) : (
          <ScheduleForbiddenPanel />
        )}
      </div>
    </article>
  );
}
