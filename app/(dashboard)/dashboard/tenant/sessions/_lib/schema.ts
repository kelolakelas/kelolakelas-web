import { z } from 'zod';
import type { ListPagination } from '@/lib/list-envelope';
import { studentLastName, type StudentSurnameFields } from '@/lib/students';

/**
 * Types, vocabulary, and pure helpers for the tutor session and attendance
 * screen (KEL-137).
 *
 * Everything here is synchronous and side effect free so the filter parsing,
 * the date ranges, and the row presentation can be unit tested without a
 * gateway or a request context. The asynchronous gateway reads live in
 * `../_queries/queries.ts` and the mass attendance mutation in
 * `../_actions/attendance.ts`.
 *
 * Three contracts back this screen, all proxied unchanged by the API gateway:
 *
 * - `GET /api/v1/sessions?mine=true&date_from=&date_to=&class_id=` (academic,
 *   guarded by `schedule:read`) answers the paginated `{ items, pagination }`
 *   envelope. `mine=true` limits the list to sessions where the caller is the
 *   tutor, derived from the verified JWT member claim; a client-supplied
 *   `tutor_id` is stripped server-side (KEL-135).
 * - `GET /api/v1/sessions/:id/attendees` (academic, guarded by
 *   `schedule:read`) answers the attendee list as a bare enrollment array
 *   (not the paginated envelope).
 * - `POST /api/v1/attendance` with `{ enrollment_id, session_id, status }`
 *   (academic, guarded by `attendance:create`) records one row. The gateway
 *   registers no `/attendance/bulk` or `/attendance/by-session` static route,
 *   so the mass form saves one row per request and the contract's
 *   "sebagian simpan gagal" edge case is reported per row. The session_id
 *   form is the only one that addresses reschedule replacements (KEL-134).
 * - `GET /api/v1/attendance?enrollment_id=` (academic, guarded by
 *   `attendance:read`) answers the same envelope and is read back after a
 *   refresh, filtered client-side by `session_id`.
 */

/** Canonical path of this screen, used by links and the filter form. */
export const TENANT_SESSIONS_PATH = '/dashboard/tenant/sessions';

/**
 * Attendance statuses accepted by `POST /api/v1/attendance`.
 *
 * The vocabulary matches the academic service (`present`, `absent`, `late`,
 * `excused`); the filter form, the request builder, and the radio group share
 * this single schema instead of repeating the strings.
 */
export const attendanceStatusSchema = z.enum(['present', 'late', 'excused', 'absent']);

export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

/**
 * Attendance status options in the order the form presents them, with the
 * Indonesian labels the member reads.
 */
export const ATTENDANCE_STATUS_OPTIONS: readonly {
  value: AttendanceStatus;
  label: string;
}[] = [
  { value: 'present', label: 'Hadir' },
  { value: 'late', label: 'Telat' },
  { value: 'excused', label: 'Izin' },
  { value: 'absent', label: 'Alfa' },
] as const;

/**
 * Session lifecycle states emitted by `GET /api/v1/sessions`.
 *
 * Both `scheduled` and `rescheduled` rows belong to the tutor's week: a
 * reschedule keeps the original row with status `rescheduled` and inserts a
 * replacement with status `scheduled`, so filtering either one out would hide
 * a session the acceptance criteria require to be visible.
 */
export const sessionStatusSchema = z.enum(['scheduled', 'rescheduled', 'cancelled', 'completed']);

export type SessionStatus = z.infer<typeof sessionStatusSchema>;

/**
 * One row of `GET /api/v1/sessions`.
 *
 * Only the fields this screen renders are declared; the endpoint returns
 * more, and reading extra fields is never required here.
 */
export interface TutorSession {
  id: string;
  class_id: string;
  schedule_id?: string | null;
  enrollment_id?: string | null;
  tutor_id?: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  class?: { id?: string; name?: string | null } | null;
}

/** Student fields an attendee row serialises (surname: `lib/students.ts`). */
export interface SessionAttendeeStudent extends StudentSurnameFields {
  first_name?: string | null;
}

/**
 * One attendee of `GET /api/v1/sessions/:id/attendees`.
 *
 * The endpoint answers a bare enrollment array with the student preloaded;
 * `enrollment_id` is the identifier the attendance write addresses.
 */
export interface SessionAttendee {
  enrollment_id: string;
  student?: SessionAttendeeStudent | null;
}

/**
 * One attendance row of `GET /api/v1/attendance`.
 *
 * `session_id` is how a read-back row is matched to the session the form
 * saved: the list endpoint understands no `session_id` filter, so the rows
 * are read per enrollment and filtered client-side.
 */
export interface SessionAttendanceRecord {
  id: string;
  enrollment_id: string;
  session_id: string;
  status: string;
}

/** Which week slice the tutor is looking at. */
export const sessionRangeSchema = z.enum(['today', 'week']);

export type SessionRange = z.infer<typeof sessionRangeSchema>;

/** Filter state this screen round-trips through the URL. */
export interface SessionFilters {
  range: SessionRange;
  class_id: string;
}

export type SessionFilterResult =
  | { filters: SessionFilters; error: null }
  | { filters: null; error: 'invalid_filter' };

/** Filter state used to render the form when the submitted one was rejected. */
export const EMPTY_SESSION_FILTERS: SessionFilters = { range: 'today', class_id: '' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether an identifier taken from a URL or a response is a UUID.
 *
 * `GET /api/v1/sessions` answers `400 invalid class_id` for a value that is
 * not a UUID, so a malformed filter must produce an explanation instead of a
 * failed request.
 */
export function isSessionUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function firstValue(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }

  return '';
}

/**
 * Reads the `range` and `class_id` query parameters into the filter state.
 *
 * A `range` outside the `today`/`week` vocabulary, or a `class_id` that is
 * not a UUID, is reported as `invalid_filter` instead of being forwarded.
 * An absent or empty parameter keeps its default, so a plain `/sessions`
 * visit lands on today's sessions.
 */
export function parseSessionFilters(
  input: Record<string, string | string[] | undefined>
): SessionFilterResult {
  const rawRange = firstValue(input.range).trim();
  const rawClassId = firstValue(input.class_id).trim();

  let range: SessionRange = 'today';

  if (rawRange !== '') {
    const parsed = sessionRangeSchema.safeParse(rawRange);

    if (!parsed.success) {
      return { filters: null, error: 'invalid_filter' };
    }

    range = parsed.data;
  }

  if (rawClassId !== '' && !isSessionUuid(rawClassId)) {
    return { filters: null, error: 'invalid_filter' };
  }

  return { filters: { range, class_id: rawClassId }, error: null };
}

/** Midnight of the given date in Asia/Jakarta, as `YYYY-MM-DD`. */
function jakartaDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const lookup = new Map(parts.map((part) => [part.type, part.value]));

  return `${lookup.get('year')}-${lookup.get('month')}-${lookup.get('day')}`;
}

/**
 * Day the weekly slice starts on.
 *
 * The week starts on Monday (Asia/Jakarta): the Jakarta weekday is derived
 * from the instant, so a Sunday evening in UTC that is already Monday in
 * Jakarta opens the new week.
 */
function jakartaWeekday(date: Date): number {
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
  }).format(date);

  const index: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return index[dayName] ?? 0;
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);

  return utc.toISOString().slice(0, 10);
}

/**
 * Inclusive `date_from`/`date_to` bounds for one filter state.
 *
 * `today` covers the single Jakarta day; `week` covers Monday to Sunday of
 * the Jakarta week containing `now`. The bounds are plain calendar dates
 * because the academic service parses `date_from`/`date_to` strictly as
 * `YYYY-MM-DD`.
 */
export function sessionDateRange(filters: SessionFilters, now: Date = new Date()): {
  date_from: string;
  date_to: string;
} {
  const today = jakartaDateString(now);

  if (filters.range === 'today') {
    return { date_from: today, date_to: today };
  }

  const daysSinceMonday = (jakartaWeekday(now) + 6) % 7;
  const monday = addDays(today, -daysSinceMonday);

  return { date_from: monday, date_to: addDays(monday, 6) };
}

/**
 * Query string for the tutor session list.
 *
 * `mine=true` is always sent: this screen shows the caller's own sessions,
 * never another tutor's. The academic service derives the tutor from the
 * verified JWT member claim and strips any client-supplied `tutor_id`
 * (KEL-135), so none is sent.
 */
export function sessionQueryString(
  filters: SessionFilters,
  range: { date_from: string; date_to: string }
): string {
  const params = new URLSearchParams({
    mine: 'true',
    date_from: range.date_from,
    date_to: range.date_to,
    page: '1',
    page_size: '100',
  });

  if (filters.class_id) {
    params.set('class_id', filters.class_id);
  }

  return params.toString();
}

/**
 * Query string asking the academic service for the attendance rows of exactly
 * one enrollment.
 *
 * `page_size=100` covers every session of the visible week: one enrollment
 * holds at most one row per session, and the caller filters the rows by
 * `session_id` itself.
 */
export function sessionAttendanceQueryString(enrollmentId: string): string {
  const params = new URLSearchParams({
    page: '1',
    page_size: '100',
    enrollment_id: enrollmentId,
  });

  return params.toString();
}

/** Link to this screen at another filter state, preserving the range. */
export function sessionPageHref(filters: SessionFilters): string {
  const params = new URLSearchParams();

  if (filters.range !== 'today') {
    params.set('range', filters.range);
  }

  if (filters.class_id) {
    params.set('class_id', filters.class_id);
  }

  const query = params.toString();

  return query ? `${TENANT_SESSIONS_PATH}?${query}` : TENANT_SESSIONS_PATH;
}

/**
 * Indonesian label of an attendance status.
 *
 * An unknown value is shown verbatim rather than hidden: attendance statuses
 * are written by the academic service, so a state this screen has not been
 * taught about should be visible instead of being displayed as if it were
 * one of the known ones.
 */
export function attendanceStatusLabel(status: string): string {
  const option = ATTENDANCE_STATUS_OPTIONS.find((candidate) => candidate.value === status);

  return option ? option.label : status;
}

/**
 * Display name of the student behind an attendee row.
 *
 * The academic service serialises the surname as `last_name` (KEL-43); the
 * shared `studentLastName` reader keeps the legacy fallback in one place.
 */
export function sessionAttendeeName(
  student: ({ first_name?: string | null } & StudentSurnameFields) | null | undefined
): string {
  if (!student) {
    return 'Student';
  }

  const first = typeof student.first_name === 'string' ? student.first_name.trim() : '';
  const name = [first, studentLastName(student)].filter(Boolean).join(' ');

  return name || 'Student';
}

/**
 * Indexes attendance rows by enrollment id, keeping only the rows that belong
 * to the given session.
 *
 * The list endpoint cannot filter by `session_id`, so the caller passes the
 * session it saved and this index decides what the refresh shows: one row
 * per enrollment, or nothing when no row was recorded for that enrollment.
 */
export function attendanceByEnrollment(
  records: readonly SessionAttendanceRecord[],
  sessionId: string
): Map<string, SessionAttendanceRecord> {
  const index = new Map<string, SessionAttendanceRecord>();

  for (const record of records) {
    if (record?.session_id !== sessionId) {
      continue;
    }

    if (typeof record?.enrollment_id === 'string' && record.enrollment_id !== '' && !index.has(record.enrollment_id)) {
      index.set(record.enrollment_id, record);
    }
  }

  return index;
}

/**
 * Normalises one attendee entry of `GET /api/v1/sessions/:id/attendees`.
 *
 * The endpoint answers a bare enrollment array with the student preloaded.
 * Entries without a usable `id` are skipped because the attendance write
 * addresses the enrollment by that identifier.
 */
export function normalizeSessionAttendees(value: unknown): SessionAttendee[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const attendees: SessionAttendee[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const candidate = entry as { id?: unknown; student?: unknown };

    if (typeof candidate.id !== 'string' || candidate.id === '') {
      continue;
    }

    const student =
      candidate.student && typeof candidate.student === 'object'
        ? (candidate.student as SessionAttendeeStudent)
        : null;

    attendees.push({ enrollment_id: candidate.id, student });
  }

  return attendees;
}

/**
 * Normalises one attendance entry of `GET /api/v1/attendance`.
 *
 * Rows without a usable `id`, `enrollment_id`, or `session_id` are skipped:
 * the read-back index matches rows to the saved session by those
 * identifiers, and a row missing one cannot be shown anywhere.
 */
export function normalizeSessionAttendance(value: unknown): SessionAttendanceRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const records: SessionAttendanceRecord[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const candidate = entry as { id?: unknown; enrollment_id?: unknown; session_id?: unknown; status?: unknown };

    if (
      typeof candidate.id !== 'string' ||
      candidate.id === '' ||
      typeof candidate.enrollment_id !== 'string' ||
      candidate.enrollment_id === '' ||
      typeof candidate.session_id !== 'string' ||
      candidate.session_id === '' ||
      typeof candidate.status !== 'string'
    ) {
      continue;
    }

    records.push({
      id: candidate.id,
      enrollment_id: candidate.enrollment_id,
      session_id: candidate.session_id,
      status: candidate.status,
    });
  }

  return records;
}

/**
 * Session date formatted for an Indonesian reader.
 *
 * A missing or malformed value renders as an em dash rather than a guessed
 * date. The time window is rendered from the raw `HH:MM:SS` strings because
 * the session date carries no timezone and parsing it as an instant would
 * shift the day around midnight.
 */
export function sessionDateLabel(sessionDate?: string | null): string {
  if (typeof sessionDate !== 'string' || !DATE_PATTERN.test(sessionDate)) {
    return '—';
  }

  const [year, month, day] = sessionDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(parsed);
}

/** Start–end window of a session (`15:30–17:00`), or an em dash. */
export function sessionTimeLabel(startTime?: string | null, endTime?: string | null): string {
  const start = typeof startTime === 'string' ? startTime.slice(0, 5) : '';
  const end = typeof endTime === 'string' ? endTime.slice(0, 5) : '';

  if (!start || !end) {
    return '—';
  }

  return `${start}–${end}`;
}

/**
 * Indonesian label of a session status.
 *
 * A rescheduled row keeps its own badge: the original row with status
 * `rescheduled` and its replacement with status `scheduled` are both
 * visible, so the member can tell which one moved.
 */
export function sessionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: 'Terjadwal',
    rescheduled: 'Dijadwalkan ulang',
    cancelled: 'Dibatalkan',
    completed: 'Selesai',
  };

  return labels[status] ?? status;
}

/** Class name of a session, or a neutral placeholder when it is missing. */
export function sessionClassName(session: TutorSession): string {
  const name = session.class?.name;

  return typeof name === 'string' && name.trim() ? name.trim() : 'Kelas';
}

/** Pagination summary sentence for the result count line. */
export function sessionCountLabel(pagination: ListPagination): string {
  const total = pagination.total_items;

  return total === 1 ? '1 sesi' : `${total} sesi`;
}
