import { z } from 'zod';
import { studentLastName, type StudentSurnameFields } from '@/lib/students';

/**
 * Types, vocabulary, and pure helpers for the tenant private schedule request
 * review screen (KEL-110).
 *
 * Everything here is synchronous and side effect free so the filter parsing
 * and the row presentation can be unit tested without a gateway or a request
 * context. The asynchronous gateway reads live in `../_queries/queries.ts`
 * and the approve/reject mutations in `../_actions/actions.ts`.
 *
 * Two contracts back this screen, both proxied unchanged by the API gateway:
 *
 * - `GET /api/v1/schedule-requests[?status=]` (academic, guarded by
 *   `enrollment:read`; parent tokens skipped) answers the request rows. The
 *   repository caps the list at 100 rows ordered newest first, so this screen
 *   sends only `status` and renders a single page.
 * - `GET /api/v1/classes` answers the tenant's own classes, used to label a
 *   request with its class name. Student names come from
 *   `GET /api/v1/students/:id` best-effort: a request-only student has no
 *   enrollment yet, so the lookup degrades to a neutral placeholder instead
 *   of failing the page.
 */

/** Canonical path of this screen, used by links and the filter form. */
export const TENANT_SCHEDULE_REQUESTS_PATH = '/dashboard/tenant/schedule-requests';

/**
 * Request statuses accepted by `GET /api/v1/schedule-requests`.
 *
 * The vocabulary matches `SCHEDULE_REQUEST_STATUSES` in
 * `lib/schedule-request`; the filter form and the request builder share this
 * single schema instead of repeating the strings.
 */
export const scheduleRequestStatusFilterSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled']);

export type ScheduleRequestStatusFilter = z.infer<typeof scheduleRequestStatusFilterSchema>;

/** Filter state this screen round-trips through the URL. */
export interface ScheduleRequestFilters {
  status: ScheduleRequestStatusFilter | '';
}

export type ScheduleRequestFilterResult =
  | { filters: ScheduleRequestFilters; error: null }
  | { filters: null; error: 'invalid_filter' };

/**
 * Filter state used to render the form when the submitted one was rejected,
 * and the default work queue: pending requests waiting for a decision.
 */
export const DEFAULT_SCHEDULE_REQUEST_FILTERS: ScheduleRequestFilters = { status: 'pending' };

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
 * Reads the `status` query parameter into the filter state.
 *
 * A `status` outside the backend vocabulary is reported as `invalid_filter`
 * instead of being forwarded: the academic service answers it with `400`,
 * and a filter somebody typed by hand should produce an explanation rather
 * than a failed request. An absent or empty parameter selects the pending
 * work queue, so a plain visit lands where decisions are waiting.
 */
export function parseScheduleRequestFilters(
  input: Record<string, string | string[] | undefined>
): ScheduleRequestFilterResult {
  const rawStatus = firstValue(input.status).trim();

  if (rawStatus === '') {
    return { filters: { ...DEFAULT_SCHEDULE_REQUEST_FILTERS }, error: null };
  }

  const parsed = scheduleRequestStatusFilterSchema.safeParse(rawStatus);

  if (!parsed.success) {
    return { filters: null, error: 'invalid_filter' };
  }

  return { filters: { status: parsed.data }, error: null };
}

/**
 * Query string for the tenant schedule-request list.
 *
 * Only `status` is sent. The repository serves at most 100 rows newest first
 * and understands no page parameters, so sending them would imply a paging
 * contract the backend does not have.
 */
export function scheduleRequestQueryString(filters: ScheduleRequestFilters): string {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set('status', filters.status);
  }

  return params.toString();
}

/** Link to this screen at another status filter. */
export function scheduleRequestPageHref(filters: ScheduleRequestFilters): string {
  const query = scheduleRequestQueryString(filters);

  return query ? `${TENANT_SCHEDULE_REQUESTS_PATH}?${query}` : TENANT_SCHEDULE_REQUESTS_PATH;
}

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: 'Bulanan',
  quarterly: 'Per tiga bulan',
  yearly: 'Tahunan',
};

/** Indonesian label of a request billing cycle; unknown values pass through. */
export function scheduleRequestBillingCycleLabel(billingCycle: string): string {
  return BILLING_CYCLE_LABELS[billingCycle] || billingCycle;
}

/** Class name of a request, or a neutral placeholder when it is missing. */
export function scheduleRequestClassName(className: string | null | undefined): string {
  return typeof className === 'string' && className.trim() ? className.trim() : 'Kelas';
}

/**
 * Display name of the student behind a request.
 *
 * The academic service serialises the surname as `last_name` (KEL-43); the
 * shared `studentLastName` reader keeps the legacy fallback in one place.
 */
export function scheduleRequestStudentName(
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
 * Indexes tenant classes by id so a request can be labelled by its
 * `class_id`. Entries without a usable id are skipped.
 */
export interface ScheduleRequestClassLike {
  id: string;
  name: string;
}

export function classesById(classes: readonly ScheduleRequestClassLike[]): Map<string, ScheduleRequestClassLike> {
  const index = new Map<string, ScheduleRequestClassLike>();

  for (const classEntity of classes) {
    if (typeof classEntity?.id === 'string' && classEntity.id !== '') {
      index.set(classEntity.id, classEntity);
    }
  }

  return index;
}

/**
 * Submission time of a request, formatted for an Indonesian reader.
 *
 * Tenant rows carry `created_at`; a missing or malformed value renders as an
 * em dash rather than a guessed date.
 */
export function submittedAtLabel(createdAt?: string | null): string {
  if (typeof createdAt !== 'string' || createdAt === '') {
    return '—';
  }

  const parsed = new Date(createdAt);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(parsed);
}

/** Result count sentence for the list header. */
export function scheduleRequestCountLabel(total: number): string {
  return total === 1 ? '1 permintaan' : `${total} permintaan`;
}
