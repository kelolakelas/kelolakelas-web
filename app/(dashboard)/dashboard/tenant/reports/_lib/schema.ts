import { z } from 'zod';
import type { ListPagination } from '@/lib/list-envelope';
import { studentLastName, type StudentSurnameFields } from '@/lib/students';

/**
 * Types, vocabulary, and pure helpers for the tenant student-evaluation
 * report screen (KEL-139).
 *
 * Everything here is synchronous and side effect free so the form schema,
 * the filter parsing, and the row presentation can be unit tested without a
 * gateway or a request context. The asynchronous gateway reads live in
 * `../_queries/queries.ts` and the mutations in `../_actions/reports.ts`.
 *
 * Three contracts back this screen, all proxied unchanged by the API
 * gateway (`router.go`):
 *
 * - `GET /api/v1/reports` (academic, guarded by `report:read`) answers the
 *   paginated `{ items, pagination }` envelope. Filters are `search`
 *   (title/notes), `enrollment_id`, `student_id`, `reporter_id`, and
 *   `date_from`/`date_to` as strict `YYYY-MM-DD`. There is no `class_id`
 *   filter; the class only arrives preloaded on each row's `enrollment`.
 * - `POST /api/v1/reports` with `{ enrollment_id, title, evaluation_notes?,
 *   score? }` (academic, guarded by `report:create`) creates one row. A
 *   tutor who does not teach the enrollment is refused with `403 "Tutor is
 *   not assigned to this enrollment"`.
 * - `PATCH /api/v1/reports/:id` with `{ title, evaluation_notes?, score? }`
 *   (guarded by `report:update`) and `DELETE /api/v1/reports/:id` (guarded
 *   by `report:delete`) apply the same assignment rule against the stored
 *   enrollment, so a caller cannot retarget a report to a class they teach.
 *
 * Field shapes mirror `domain.CreateReportRequest`/`UpdateReportRequest` in
 * the academic service: `title` required max 255, `score` optional 0–100.
 */

/** Canonical path of this screen, used by links and the filter form. */
export const TENANT_REPORTS_PATH = '/dashboard/tenant/reports';

/** Rows per report page; matches the academic service default. */
export const REPORT_PAGE_SIZE = 20;

/** Student fields a report enrollment serialises (surname: `lib/students.ts`). */
export interface ReportStudent extends StudentSurnameFields {
  first_name?: string | null;
}

/** Class fields a report enrollment serialises. */
export interface ReportClass {
  id?: string;
  name?: string | null;
}

/**
 * Enrollment behind a report row.
 *
 * `GET /api/v1/reports` preloads `Enrollment` (with its student and class),
 * so the row already carries the names the list renders. The enrollment
 * identifier is what the create write addresses.
 */
export interface ReportEnrollment {
  id: string;
  student_id?: string;
  class_id?: string;
  status?: string;
  student?: ReportStudent | null;
  class?: ReportClass | null;
}

/**
 * One row of `GET /api/v1/reports`.
 *
 * Only the fields this screen renders are declared; the endpoint serialises
 * tenant/reporter timestamps around them, and reading extra fields is never
 * required here.
 */
export interface TenantReport {
  id: string;
  enrollment_id: string;
  reporter_id?: string;
  title: string;
  evaluation_notes?: string | null;
  score?: number | null;
  created_at?: string | null;
  enrollment?: ReportEnrollment | null;
}

/** One enrollment option for the filter select and the create form. */
export interface ReportEnrollmentOption {
  enrollment_id: string;
  label: string;
}

/** Filter state this screen round-trips through the URL. */
export interface ReportFilters {
  page: number;
  search: string;
  enrollment_id: string;
  date_from: string;
  date_to: string;
}

export type ReportFilterResult =
  | { filters: ReportFilters; error: null }
  | { filters: null; error: 'invalid_filter' };

/** Filter state used to render the form when the submitted one was rejected. */
export const EMPTY_REPORT_FILTERS: ReportFilters = {
  page: 1,
  search: '',
  enrollment_id: '',
  date_from: '',
  date_to: '',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether an identifier taken from a URL or a response is a UUID.
 *
 * `GET /api/v1/reports` answers `400 invalid enrollment_id` for a value
 * that is not a UUID, so a malformed filter must produce an explanation
 * instead of a failed request.
 */
export function isReportUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Whether `YYYY-MM-DD` names a real calendar day.
 *
 * The shape pattern alone would accept `2026-02-30`, which the backend
 * refuses; rejecting it up front keeps the member from submitting a filter
 * that cannot run.
 */
export function isValidReportDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const utc = new Date(Date.UTC(year, month - 1, day));

  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
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
 * Reads the `page`, `search`, `enrollment_id`, `date_from`, and `date_to`
 * query parameters into the filter state.
 *
 * A non-positive `page`, a non-UUID `enrollment_id`, a malformed date, or a
 * `date_from` after `date_to` is reported as `invalid_filter` instead of
 * being forwarded: the academic service answers each with `400`, and a
 * filter somebody typed by hand should produce an explanation rather than a
 * failed request. Absent parameters keep their defaults.
 */
export function parseReportFilters(
  input: Record<string, string | string[] | undefined>
): ReportFilterResult {
  const rawPage = firstValue(input.page).trim();
  const search = firstValue(input.search).trim().slice(0, 255);
  const enrollmentId = firstValue(input.enrollment_id).trim();
  const dateFrom = firstValue(input.date_from).trim();
  const dateTo = firstValue(input.date_to).trim();

  if (rawPage !== '' && !/^[1-9]\d*$/.test(rawPage)) {
    return { filters: null, error: 'invalid_filter' };
  }

  if (enrollmentId !== '' && !isReportUuid(enrollmentId)) {
    return { filters: null, error: 'invalid_filter' };
  }

  if (dateFrom !== '' && !isValidReportDate(dateFrom)) {
    return { filters: null, error: 'invalid_filter' };
  }

  if (dateTo !== '' && !isValidReportDate(dateTo)) {
    return { filters: null, error: 'invalid_filter' };
  }

  if (dateFrom !== '' && dateTo !== '' && dateFrom > dateTo) {
    return { filters: null, error: 'invalid_filter' };
  }

  return {
    filters: {
      page: rawPage === '' ? 1 : Number(rawPage),
      search,
      enrollment_id: enrollmentId,
      date_from: dateFrom,
      date_to: dateTo,
    },
    error: null,
  };
}

/**
 * Query string for the tenant report list.
 *
 * Only the vocabulary the academic `parseReportQuery` understands is sent:
 * dates stay plain `YYYY-MM-DD` because the service parses them strictly in
 * that layout. `page_size` is always sent so the screen never silently
 * falls back if the service default ever changes.
 */
export function reportQueryString(filters: ReportFilters): string {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(REPORT_PAGE_SIZE),
  });

  if (filters.search) {
    params.set('search', filters.search);
  }

  if (filters.enrollment_id) {
    params.set('enrollment_id', filters.enrollment_id);
  }

  if (filters.date_from) {
    params.set('date_from', filters.date_from);
  }

  if (filters.date_to) {
    params.set('date_to', filters.date_to);
  }

  return params.toString();
}

/** Link to this screen at another page, preserving the active filters. */
export function reportPageHref(filters: ReportFilters): string {
  const params = new URLSearchParams();

  if (filters.page !== 1) {
    params.set('page', String(filters.page));
  }

  if (filters.search) {
    params.set('search', filters.search);
  }

  if (filters.enrollment_id) {
    params.set('enrollment_id', filters.enrollment_id);
  }

  if (filters.date_from) {
    params.set('date_from', filters.date_from);
  }

  if (filters.date_to) {
    params.set('date_to', filters.date_to);
  }

  const query = params.toString();

  return query ? `${TENANT_REPORTS_PATH}?${query}` : TENANT_REPORTS_PATH;
}

/**
 * Whether a raw score form value is usable.
 *
 * Empty means "belum dinilai" and is valid: the backend field is optional.
 * Otherwise the value must parse to a finite number within 0–100, mirroring
 * the `gte=0,lte=100` binding on the backend request structs.
 */
export function isValidScoreInput(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed === '') {
    return true;
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return false;
  }

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
}

/**
 * Raw report form fields as the Server Action reads them from `FormData`.
 *
 * `score` stays a string here so the schema can report "di luar 0–100"
 * against exactly what the member typed; `reportCreatePayload` /
 * `reportUpdatePayload` convert the validated value to the JSON number the
 * backend binds.
 */
export const reportFormSchema = z.object({
  enrollment_id: z
    .string()
    .trim()
    .refine(isReportUuid, 'Enrollment tidak valid. Pilih siswa dari daftar.'),
  title: z
    .string()
    .trim()
    .min(1, 'Judul laporan wajib diisi.')
    .max(255, 'Judul laporan maksimal 255 karakter.'),
  evaluation_notes: z.string().trim().max(5000, 'Catatan evaluasi maksimal 5000 karakter.'),
  score: z
    .string()
    .trim()
    .refine(isValidScoreInput, 'Skor harus berupa angka 0 sampai 100. Kosongkan bila belum dinilai.'),
});

export type ReportFormInput = z.infer<typeof reportFormSchema>;

/** Identifier of the report an update or delete addresses. */
export const reportIdSchema = z.string().trim().refine(isReportUuid, 'ID laporan tidak valid.');

/**
 * Update form fields: the same vocabulary as create, minus the enrollment.
 *
 * The update endpoint binds `UpdateReportRequest` with no enrollment field;
 * the assignment check runs against the stored enrollment, so none is sent.
 */
export const reportUpdateFormSchema = z.object({
  report_id: reportIdSchema,
  title: reportFormSchema.shape.title,
  evaluation_notes: reportFormSchema.shape.evaluation_notes,
  score: reportFormSchema.shape.score,
});

export type ReportUpdateFormInput = z.infer<typeof reportUpdateFormSchema>;

/**
 * Exact `POST /api/v1/reports` body for a validated form.
 *
 * Only the field names `CreateReportRequest` binds are sent
 * (`enrollment_id`, `title`, `evaluation_notes`, `score`). Optional fields
 * are omitted when empty rather than sent as empty strings the backend
 * would store verbatim.
 */
export function reportCreatePayload(data: ReportFormInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    enrollment_id: data.enrollment_id,
    title: data.title,
  };

  if (data.evaluation_notes !== '') {
    body.evaluation_notes = data.evaluation_notes;
  }

  if (data.score !== '') {
    body.score = Number(data.score);
  }

  return body;
}

/**
 * Exact `PATCH /api/v1/reports/:id` body for a validated form.
 *
 * `UpdateReportRequest` carries no enrollment field, so `enrollment_id` is
 * never sent even though the create form needs it.
 */
export function reportUpdatePayload(data: ReportUpdateFormInput): Record<string, unknown> {
  const body: Record<string, unknown> = { title: data.title };

  if (data.evaluation_notes !== '') {
    body.evaluation_notes = data.evaluation_notes;
  }

  if (data.score !== '') {
    body.score = Number(data.score);
  }

  return body;
}

/**
 * Whether the report screen offers the write actions for one membership
 * read (KEL-139).
 *
 * Fail-closed per action: each mutation is offered only on a confirmed
 * membership carrying its own permission (`report:create`, `report:update`,
 * `report:delete`). When the membership cannot be read the member is
 * treated as lacking every write permission. The backend stays the access
 * authority and refuses the mutation with the same permission.
 */
export function reportWritePermissions(nav: {
  state: string;
  membership: { permissions: readonly string[] } | null;
}): { canCreate: boolean; canUpdate: boolean; canDelete: boolean } {
  const granted =
    nav.state === 'ok' && nav.membership !== null
      ? new Set(nav.membership.permissions)
      : new Set<string>();

  return {
    canCreate: granted.has('report:create'),
    canUpdate: granted.has('report:update'),
    canDelete: granted.has('report:delete'),
  };
}

/**
 * Normalises one enrollment entry preloaded on a report row.
 *
 * Entries without a usable `id` are dropped: the update and delete writes
 * address the report itself, but the list labels and the create form trace
 * every option back to an enrollment identifier.
 */
export function normalizeReportEnrollment(value: unknown): ReportEnrollment | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    id?: unknown;
    student_id?: unknown;
    class_id?: unknown;
    status?: unknown;
    student?: unknown;
    class?: unknown;
  };

  if (typeof candidate.id !== 'string' || candidate.id === '') {
    return null;
  }

  const student =
    candidate.student && typeof candidate.student === 'object'
      ? (candidate.student as ReportStudent)
      : null;
  const klass =
    candidate.class && typeof candidate.class === 'object' ? (candidate.class as ReportClass) : null;

  return {
    id: candidate.id,
    ...(typeof candidate.student_id === 'string' ? { student_id: candidate.student_id } : {}),
    ...(typeof candidate.class_id === 'string' ? { class_id: candidate.class_id } : {}),
    ...(typeof candidate.status === 'string' ? { status: candidate.status } : {}),
    ...(student ? { student } : {}),
    ...(klass ? { class: klass } : {}),
  };
}

/**
 * Normalises one row of `GET /api/v1/reports`.
 *
 * Rows without a usable `id` cannot be updated or deleted, so they are
 * skipped instead of rendered half-broken. A missing or blank title falls
 * back to a neutral label; a non-numeric `score` reads as "belum dinilai"
 * rather than crashing the badge.
 */
export function normalizeTenantReport(value: unknown): TenantReport | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    id?: unknown;
    enrollment_id?: unknown;
    reporter_id?: unknown;
    title?: unknown;
    evaluation_notes?: unknown;
    score?: unknown;
    created_at?: unknown;
    enrollment?: unknown;
  };

  if (typeof candidate.id !== 'string' || candidate.id === '') {
    return null;
  }

  const title =
    typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.trim() : 'Laporan';

  return {
    id: candidate.id,
    enrollment_id: typeof candidate.enrollment_id === 'string' ? candidate.enrollment_id : '',
    ...(typeof candidate.reporter_id === 'string' ? { reporter_id: candidate.reporter_id } : {}),
    title,
    ...(typeof candidate.evaluation_notes === 'string' ? { evaluation_notes: candidate.evaluation_notes } : {}),
    ...(typeof candidate.score === 'number' && Number.isFinite(candidate.score)
      ? { score: candidate.score }
      : {}),
    ...(typeof candidate.created_at === 'string' ? { created_at: candidate.created_at } : {}),
    ...(candidate.enrollment && typeof candidate.enrollment === 'object'
      ? (() => {
          const enrollment = normalizeReportEnrollment(candidate.enrollment);
          return enrollment ? { enrollment } : {};
        })()
      : {}),
  };
}

/**
 * Display name of the student behind a report row.
 *
 * The academic service serialises the surname as `last_name`; the shared
 * `studentLastName` reader keeps the legacy fallback in one place.
 */
export function reportStudentName(student: ReportStudent | null | undefined): string {
  if (!student) {
    return 'Siswa';
  }

  const first = typeof student.first_name === 'string' ? student.first_name.trim() : '';
  const name = [first, studentLastName(student)].filter(Boolean).join(' ');

  return name || 'Siswa';
}

/** Class name of a report row, or a neutral placeholder when missing. */
export function reportClassName(enrollment: ReportEnrollment | null | undefined): string {
  const name = enrollment?.class?.name;

  return typeof name === 'string' && name.trim() ? name.trim() : 'Kelas';
}

/** One-line label for an enrollment option (`Nama Siswa · Nama Kelas`). */
export function reportEnrollmentLabel(enrollment: ReportEnrollment): string {
  return `${reportStudentName(enrollment.student ?? null)} · ${reportClassName(enrollment)}`;
}

/**
 * Report creation time formatted for an Indonesian reader.
 *
 * A missing or malformed value renders as an em dash rather than a guessed
 * date. `created_at` is a full timestamp (unlike a session's bare calendar
 * date), so it is parsed as an instant and rendered in Asia/Jakarta.
 */
export function reportDateLabel(createdAt?: string | null): string {
  if (typeof createdAt !== 'string' || createdAt === '') {
    return '—';
  }

  const parsed = new Date(createdAt);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(parsed);
}

/** Score badge text, or the "not yet graded" state when no score was given. */
export function reportScoreLabel(score?: number | null): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return 'Belum dinilai';
  }

  return `Nilai: ${score}`;
}

/** Pagination summary sentence for the result count line. */
export function reportCountLabel(pagination: ListPagination): string {
  const total = pagination.total_items;

  return total === 1 ? '1 laporan' : `${total} laporan`;
}
