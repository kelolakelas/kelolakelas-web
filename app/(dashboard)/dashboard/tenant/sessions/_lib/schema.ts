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

const SESSION_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const RESCHEDULE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function sessionTimeToMinutes(value: string): number {
  const [hours, minutes, seconds] = value.split(':').map(Number);
  return hours * 60 + minutes + (seconds ? seconds / 60 : 0);
}

/**
 * Whether `YYYY-MM-DD` names a real calendar day (KEL-138).
 *
 * The reschedule date pattern only checks the shape, so `2026-02-30`
 * would pass it while naming no day. The backend would refuse the write;
 * rejecting it up front keeps the member from submitting a date that
 * cannot be saved.
 */
export function isValidCalendarDate(value: string): boolean {
  if (!RESCHEDULE_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const utc = new Date(Date.UTC(year, month - 1, day));

  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

/**
 * Minutes since midnight in Asia/Jakarta for one instant (KEL-138).
 *
 * The reschedule form takes a plain calendar date plus a wall-clock time,
 * so "already past" is judged in the Jakarta day the member reads — not in
 * UTC, where the same instant can fall on a different date.
 */
export function jakartaTimeMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const lookup = new Map(parts.map((part) => [part.type, part.value]));

  return Number(lookup.get('hour')) * 60 + Number(lookup.get('minute'));
}

export type RescheduleScheduleIssue = {
  path: 'new_session_date' | 'new_start_time' | 'new_end_time';
  message: string;
};

/**
 * Date and time issues of a reschedule payload against one instant
 * (KEL-138).
 *
 * Extracted from `rescheduleSchema` so the Jakarta-day boundary can be
 * pinned with a fixed `now` in tests: a date before the Jakarta today is
 * past, a start time that already passed on the Jakarta today is past, and
 * a shape-correct date that names no calendar day is invalid. The schema
 * itself calls this with the current instant.
 */
export function rescheduleScheduleIssues(
  value: { new_session_date: string; new_start_time: string; new_end_time: string },
  now: Date = new Date()
): RescheduleScheduleIssue[] {
  const issues: RescheduleScheduleIssue[] = [];

  if (sessionTimeToMinutes(value.new_end_time) <= sessionTimeToMinutes(value.new_start_time)) {
    issues.push({ path: 'new_end_time', message: 'Waktu selesai harus setelah waktu mulai.' });
  }

  if (!isValidCalendarDate(value.new_session_date)) {
    issues.push({ path: 'new_session_date', message: 'Tanggal sesi tidak valid.' });
    return issues;
  }

  const today = jakartaDateString(now);

  if (value.new_session_date < today) {
    issues.push({ path: 'new_session_date', message: 'Tanggal sesi tidak boleh sudah lewat.' });
  } else if (
    value.new_session_date === today &&
    sessionTimeToMinutes(value.new_start_time) <= jakartaTimeMinutes(now)
  ) {
    issues.push({ path: 'new_start_time', message: 'Waktu mulai sudah lewat untuk hari ini.' });
  }

  return issues;
}

/**
 * Whether the session screen offers the reschedule and substitute-tutor
 * dialogs for one membership read (KEL-138).
 *
 * Fail-closed: only a confirmed membership carrying `schedule:update` is
 * offered the mutations ("Aksi disembunyikan bagi anggota tanpa
 * schedule:update"). When the membership cannot be read the member is
 * treated as lacking the permission. The backend stays the access
 * authority and refuses the mutation with the same permission.
 */
export function canManageTenantSessions(nav: {
  state: string;
  membership: { permissions: readonly string[] } | null;
}): boolean {
  return (
    nav.state === 'ok' &&
    nav.membership !== null &&
    nav.membership.permissions.includes('schedule:update')
  );
}

export const rescheduleSchema = z
  .object({
    session_id: z.string().refine(isSessionUuid, 'ID sesi tidak valid.'),
    new_session_date: z.string().regex(RESCHEDULE_DATE_PATTERN, 'Tanggal harus berformat YYYY-MM-DD.'),
    new_start_time: z.string().regex(SESSION_TIME_PATTERN, 'Waktu mulai tidak valid.'),
    new_end_time: z.string().regex(SESSION_TIME_PATTERN, 'Waktu selesai tidak valid.'),
  })
  .superRefine((value, context) => {
    for (const issue of rescheduleScheduleIssues(value)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [issue.path], message: issue.message });
    }
  });

export type RescheduleInput = z.infer<typeof rescheduleSchema>;

/**
 * Serialises a validated `YYYY-MM-DD` reschedule date for the academic
 * write (KEL-138 fix r2).
 *
 * Academic `RescheduleSessionRequest.NewSessionDate` is a `time.Time`, so
 * the JSON value must parse as RFC3339 (`2006-01-02T15:04:05Z07:00`): a bare
 * calendar date is refused with `400 parsing time ... cannot parse "" as
 * "T"`. `session_date` is a DATE column, so midnight UTC names the calendar
 * date itself — never shift it by +07:00.
 */
export function rescheduleDatePayload(value: string): string {
  return `${value}T00:00:00Z`;
}

export const substituteTutorSchema = z.object({
  session_id: z.string().refine(isSessionUuid, 'ID sesi tidak valid.'),
  substitute_tutor_id: z.string().refine(isSessionUuid, 'ID tutor tidak valid.'),
});

export type SubstituteTutorInput = z.infer<typeof substituteTutorSchema>;

/**
 * One tutor option for the substitute-tutor select (KEL-138).
 *
 * `GET /api/v1/tutors` (identity, proxied by the gateway) answers the
 * paginated `{ items, pagination }` envelope of `{ id, first_name,
 * last_name, email, status }` rows. Only the fields the select renders are
 * kept; `name` is the display string so the dialog never assembles it from
 * parts itself.
 */
export interface TutorOption {
  /** Tenant member id required by the substitute-tutor API. */
  id: string;
  name: string;
  email: string;
}

/** The identity ids needed to translate a tutor user id to a tenant member id. */
export interface TenantMemberReference {
  /** Tenant member id — the value the substitute-tutor write requires. */
  id: string;
  /** Identity account id, matched against the tutor row's user id. */
  user_id: string;
}

/**
 * Normalises the member rows of `GET /api/v1/members`.
 *
 * Only the ids the tutor mapping needs are kept. Rows without usable UUID
 * `id`/`user_id` cannot be matched, so they are dropped. A row carrying a
 * non-`active` status is dropped as well: the academic service only accepts
 * an active member of the tenant as the substitute tutor.
 */
export function normalizeTenantMembers(value: unknown): TenantMemberReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const members: TenantMemberReference[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const candidate = entry as { id?: unknown; user_id?: unknown; status?: unknown };

    if (typeof candidate.id !== 'string' || !isSessionUuid(candidate.id)) {
      continue;
    }

    if (typeof candidate.user_id !== 'string' || !isSessionUuid(candidate.user_id)) {
      continue;
    }

    if (typeof candidate.status === 'string' && candidate.status !== 'active') {
      continue;
    }

    members.push({ id: candidate.id, user_id: candidate.user_id });
  }

  return members;
}

/**
 * Resolves substitute-tutor select options from tutor rows and member rows
 * (KEL-138 fix r2).
 *
 * `GET /api/v1/tutors` answers the identity USER id, but the academic
 * substitute-tutor write requires the tenant MEMBER id, so each tutor row
 * is translated through the member row with the same `user_id`. A tutor with
 * no matching active member is dropped instead of sending a user id the
 * backend would refuse. The option keeps the tutor's display name and email;
 * only the value becomes the member id.
 */
export function resolveSubstituteTutorOptions(
  tutors: readonly TutorOption[],
  members: readonly TenantMemberReference[]
): TutorOption[] {
  const memberIdByUserId = new Map<string, string>();

  for (const member of members) {
    if (!memberIdByUserId.has(member.user_id)) {
      memberIdByUserId.set(member.user_id, member.id);
    }
  }

  const options: TutorOption[] = [];

  for (const tutor of tutors) {
    const memberId = memberIdByUserId.get(tutor.id);

    if (!memberId) {
      continue;
    }

    options.push({ id: memberId, name: tutor.name, email: tutor.email });
  }

  return options;
}

/** Display name of a tutor row, falling back to email then a neutral label. */
export function tutorDisplayName(
  tutor: { first_name?: string | null; last_name?: string | null; email?: string | null } | null | undefined
): string {
  if (!tutor) {
    return 'Tutor';
  }

  const first = typeof tutor.first_name === 'string' ? tutor.first_name.trim() : '';
  const last = typeof tutor.last_name === 'string' ? tutor.last_name.trim() : '';
  const name = [first, last].filter(Boolean).join(' ');

  if (name) {
    return name;
  }

  const email = typeof tutor.email === 'string' ? tutor.email.trim() : '';

  return email || 'Tutor';
}

/**
 * Normalises the tutor list of `GET /api/v1/tutors`.
 *
 * The `id` answered here is the identity USER id (identity
 * `member_repository.go` ListTutors selects `u.id`), not the tenant member
 * id the substitute-tutor write requires. Callers must translate these rows
 * with `resolveSubstituteTutorOptions` before rendering the select.
 *
 * Rows without a usable `id` cannot be assigned, so they are dropped instead
 * of rendered half-broken. The identity service answers UUIDs here and the
 * substitute-tutor write validates them with `isSessionUuid`, so only UUID
 * ids are kept — anything else would fail the write anyway.
 */
export function normalizeTenantTutors(value: unknown): TutorOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const tutors: TutorOption[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const candidate = entry as { id?: unknown; first_name?: unknown; last_name?: unknown; email?: unknown };

    if (typeof candidate.id !== 'string' || !isSessionUuid(candidate.id)) {
      continue;
    }

    const email = typeof candidate.email === 'string' ? candidate.email.trim() : '';

    tutors.push({
      id: candidate.id,
      name: tutorDisplayName({
        first_name: typeof candidate.first_name === 'string' ? candidate.first_name : null,
        last_name: typeof candidate.last_name === 'string' ? candidate.last_name : null,
        email,
      }),
      email,
    });
  }

  return tutors;
}

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
