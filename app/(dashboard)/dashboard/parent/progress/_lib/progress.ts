/**
 * Pure helpers for the parent progress portal (KEL-141).
 *
 * All functions are synchronous and side-effect free so they are unit
 * testable without a gateway stub. Server-side student scoping happens in
 * `_queries` (enrollments/attendance/reports accept `student_id`); the
 * helpers below only attribute already-scoped rows to one child and format
 * them for Indonesian UI in Asia/Jakarta time.
 */

export interface ProgressEnrollment {
  id: string;
  student_id?: string | null;
  schedule_id?: string | null;
  status?: string | null;
  class?: { name?: string | null } | null;
  student?: { first_name?: string | null } | null;
}

export interface ProgressSession {
  id: string;
  session_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  status?: string | null;
  schedule_id?: string | null;
  enrollment_id?: string | null;
  rescheduled_from_session_id?: string | null;
  class?: { name?: string | null } | null;
  schedule?: { day_of_week?: number | null } | null;
  enrollment?: { id?: string | null; student_id?: string | null } | null;
  rescheduled_from?: {
    schedule_id?: string | null;
    enrollment_id?: string | null;
    enrollment?: { id?: string | null; student_id?: string | null } | null;
  } | null;
}

export interface ProgressAttendance {
  id: string;
  enrollment_id?: string | null;
  session_id?: string | null;
  date?: string | null;
  status?: string | null;
  session?: { session_date?: string | null } | null;
}

export interface ProgressReport {
  id: string;
  enrollment_id?: string | null;
  title?: string | null;
  evaluation_notes?: string | null;
  score?: number | null;
  created_at?: string | null;
  enrollment?: { id?: string | null; student_id?: string | null } | null;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProgressUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Resolves which child the progress page shows.
 *
 * The requested id wins only when it belongs to the parent's own student
 * list (UUID-shaped and present); otherwise the first student is shown so
 * a stale or foreign `?student=` value can never render another parent's
 * child or an empty page when data exists. Null when the parent has no
 * students at all.
 */
export function resolveSelectedStudentId(
  studentIds: readonly string[],
  requested: string | null | undefined,
): string | null {
  if (!studentIds.length) return null;
  if (
    typeof requested === 'string' &&
    UUID_PATTERN.test(requested) &&
    studentIds.includes(requested)
  ) {
    return requested;
  }
  return studentIds[0] ?? null;
}

function enrollmentIdsOf(
  enrollments: readonly ProgressEnrollment[],
  studentId: string,
): Set<string> {
  return new Set(
    enrollments
      .filter((e) => e.student_id === studentId && typeof e.id === 'string')
      .map((e) => e.id),
  );
}

function scheduleIdsOf(
  enrollments: readonly ProgressEnrollment[],
  studentId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const e of enrollments) {
    if (e.student_id === studentId && typeof e.schedule_id === 'string' && e.schedule_id) {
      ids.add(e.schedule_id);
    }
  }
  return ids;
}

function sessionOrigin(session: ProgressSession): {
  enrollmentId?: string | null;
  enrollmentStudentId?: string | null;
  scheduleId?: string | null;
} {
  const origin = session.rescheduled_from;
  if (!origin) return {};
  return {
    enrollmentId:
      origin.enrollment_id ?? origin.enrollment?.id ?? undefined,
    enrollmentStudentId: origin.enrollment?.student_id ?? undefined,
    scheduleId: origin.schedule_id ?? undefined,
  };
}

/**
 * Keeps only the sessions of one child.
 *
 * Sessions carry no `student_id` filter server-side, so attribution happens
 * here: a private session matches through its enrollment, a group session
 * through its schedule (resolved via the child's enrollments), and a
 * reschedule replacement (nil schedule) through its origin session when the
 * origin itself is present in the fetched list.
 */
export function sessionsForStudent(
  sessions: readonly ProgressSession[],
  enrollments: readonly ProgressEnrollment[],
  studentId: string,
): ProgressSession[] {
  const enrollmentIds = enrollmentIdsOf(enrollments, studentId);
  const scheduleIds = scheduleIdsOf(enrollments, studentId);
  const byId = new Map(sessions.map((s) => [s.id, s]));

  return sessions.filter((session) => {
    if (
      typeof session.enrollment_id === 'string' &&
      enrollmentIds.has(session.enrollment_id)
    ) {
      return true;
    }
    if (session.enrollment?.student_id === studentId) return true;
    if (
      typeof session.schedule_id === 'string' &&
      session.schedule_id &&
      scheduleIds.has(session.schedule_id)
    ) {
      return true;
    }
    // Reschedule replacement: attribute like its origin session.
    if (typeof session.rescheduled_from_session_id === 'string') {
      const origin = byId.get(session.rescheduled_from_session_id);
      if (origin) {
        if (
          typeof origin.enrollment_id === 'string' &&
          enrollmentIds.has(origin.enrollment_id)
        ) {
          return true;
        }
        if (origin.enrollment?.student_id === studentId) return true;
        if (
          typeof origin.schedule_id === 'string' &&
          origin.schedule_id &&
          scheduleIds.has(origin.schedule_id)
        ) {
          return true;
        }
      }
    }
    const fallback = sessionOrigin(session);
    if (
      typeof fallback.enrollmentId === 'string' &&
      enrollmentIds.has(fallback.enrollmentId)
    ) {
      return true;
    }
    if (fallback.enrollmentStudentId === studentId) return true;
    if (
      typeof fallback.scheduleId === 'string' &&
      fallback.scheduleId &&
      scheduleIds.has(fallback.scheduleId)
    ) {
      return true;
    }
    return false;
  });
}

/** Keeps only the attendance rows of one child via the enrollment join. */
export function attendanceForStudent(
  rows: readonly ProgressAttendance[],
  enrollments: readonly ProgressEnrollment[],
  studentId: string,
): ProgressAttendance[] {
  const enrollmentIds = enrollmentIdsOf(enrollments, studentId);
  return rows.filter(
    (row) =>
      typeof row.enrollment_id === 'string' &&
      enrollmentIds.has(row.enrollment_id),
  );
}

/** Keeps only the reports of one child via the enrollment join. */
export function reportsForStudent(
  reports: readonly ProgressReport[],
  enrollments: readonly ProgressEnrollment[],
  studentId: string,
): ProgressReport[] {
  const enrollmentIds = enrollmentIdsOf(enrollments, studentId);
  return reports.filter((report) => {
    if (
      typeof report.enrollment_id === 'string' &&
      enrollmentIds.has(report.enrollment_id)
    ) {
      return true;
    }
    if (report.enrollment?.student_id === studentId) return true;
    return false;
  });
}

/** Counts attendance rows per status for the history summary. */
export function summarizeAttendance(
  rows: readonly ProgressAttendance[],
): AttendanceSummary {
  const summary: AttendanceSummary = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: rows.length,
  };
  for (const row of rows) {
    switch (row.status) {
      case 'present':
        summary.present += 1;
        break;
      case 'absent':
        summary.absent += 1;
        break;
      case 'late':
        summary.late += 1;
        break;
      case 'excused':
        summary.excused += 1;
        break;
      default:
        break;
    }
  }
  return summary;
}

export const ATTENDANCE_STATUS_LABEL: Readonly<Record<string, string>> = {
  present: 'Hadir',
  absent: 'Tidak hadir',
  late: 'Terlambat',
  excused: 'Izin',
};

/** Today in Asia/Jakarta as `YYYY-MM-DD`, regardless of server zone. */
export function jakartaToday(input?: Date): string {
  const source = input ?? new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(source);
  return parts;
}

function addDays(yyyyMmDd: string, days: number): string {
  const base = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  const shifted = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * The "upcoming sessions" window: today through 13 days later (two weeks).
 * Pure over an injectable today so tests do not depend on the clock.
 */
export function upcomingWindow(today?: string): {
  dateFrom: string;
  dateTo: string;
} {
  const from = today ?? jakartaToday();
  return { dateFrom: from, dateTo: addDays(from, 13) };
}

/** `YYYY-MM-DD` (or datetime) rendered as an Indonesian date in WIB. */
export function formatJakartaDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00+07:00` : value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  }).format(parsed);
}

/** Session date + time range rendered for the schedule list. */
export function formatSessionLabel(session: ProgressSession): string {
  const date = formatJakartaDate(session.session_date ?? null);
  const start = (session.start_time ?? '').slice(0, 5);
  const end = (session.end_time ?? '').slice(0, 5);
  if (start && end) return `${date} · ${start}–${end} WIB`;
  if (start) return `${date} · ${start} WIB`;
  return date;
}
