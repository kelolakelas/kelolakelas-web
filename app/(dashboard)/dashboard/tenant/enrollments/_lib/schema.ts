import { z } from 'zod';
import type { ListPagination } from '@/lib/list-envelope';
import { formatCurrency, type TransactionRecord } from '@/lib/payment-status';

/**
 * Types, vocabulary, and pure helpers for the tenant enrollment and payment
 * overview (KEL-33).
 *
 * Everything here is synchronous and side effect free so the filter parsing and
 * the row presentation can be unit tested without a gateway or a request
 * context. The asynchronous gateway reads live in `../_queries/queries.ts`.
 *
 * Two contracts back this screen, both proxied unchanged by the API gateway:
 *
 * - `GET /api/v1/enrollments` (academic, guarded by `enrollment:read`) answers
 *   the paginated `{ items, pagination }` envelope.
 * - `GET /api/v1/billing/transactions` (billing) answers the same envelope and
 *   accepts a single `enrollment_id`, which is how one enrollment is paired
 *   with its current payment.
 */

/** Canonical path of this screen, used by links and the filter form. */
export const TENANT_ENROLLMENTS_PATH = '/dashboard/tenant/enrollments';

/**
 * Enrollment statuses accepted by `GET /api/v1/enrollments`.
 *
 * These are the lifecycle states of an *enrollment record*. They are
 * deliberately different from the `open`/`closed`/`full`/`archived` values in
 * the classes module, which describe whether a *class* can still be sold. The
 * academic service rejects anything outside this list with
 * `400 invalid enrollment status`, so the filter form and the request builder
 * share this single vocabulary instead of repeating the strings.
 */
export const enrollmentRecordStatusSchema = z.enum([
  'pending',
  'active',
  'completed',
  'dropped',
]);

export type EnrollmentRecordStatus = z.infer<typeof enrollmentRecordStatusSchema>;

/**
 * Filter options in backend lifecycle order.
 *
 * `pending` is labelled as waiting for activation rather than waiting for
 * payment because an enrollment is only created once billing accepted the
 * checkout request; the payment state itself is reported separately by
 * `paymentPresentation`.
 */
export const ENROLLMENT_STATUS_OPTIONS: readonly {
  value: EnrollmentRecordStatus;
  label: string;
}[] = [
  { value: 'pending', label: 'Menunggu aktivasi' },
  { value: 'active', label: 'Aktif' },
  { value: 'completed', label: 'Selesai' },
  { value: 'dropped', label: 'Dibatalkan' },
] as const;

/**
 * Rows per enrollment page.
 *
 * Fixed instead of tenant selectable because the screen performs one payment
 * lookup per visible enrollment (the billing endpoint accepts a single
 * `enrollment_id` per request), so the page size is also the request fan-out.
 * 20 matches the academic service default and keeps that fan-out bounded, while
 * pagination still reaches every enrollment a tenant has.
 */
export const ENROLLMENT_PAGE_SIZE = 20;

/** Largest `page_size` each service accepts. */
const MAX_PAGE_SIZE = 100;

/** Student fields the enrollment list serialises. */
export interface EnrollmentStudent {
  first_name?: string | null;
  last_name?: string | null;
  /** Kept for compatibility with the current academic service response typo. */
  lastå_name?: string | null;
}

/** Class fields the enrollment list serialises. */
export interface EnrollmentClass {
  id?: string;
  name?: string | null;
  type?: string;
}

/**
 * One row of `GET /api/v1/enrollments`.
 *
 * Structurally satisfies `EnrollmentRecord` from `lib/payment-status`, so the
 * shared `paymentPresentation` accepts it without any conversion.
 */
export interface TenantEnrollment {
  id: string;
  status: string;
  schedule_id?: string | null;
  billing_cycle?: string;
  joined_at?: string;
  class?: EnrollmentClass | null;
  student?: EnrollmentStudent | null;
}

/**
 * One row of `GET /api/v1/schedules`.
 *
 * Only the fields needed to label an enrollment are declared; the endpoint
 * returns more, and reading extra fields is never required here.
 */
export interface TenantSchedule {
  id: string;
  class_id?: string;
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
  location?: string | null;
}

/** Filter state this screen round-trips through the URL. */
export interface EnrollmentFilters {
  page: number;
  status: EnrollmentRecordStatus | '';
}

export type EnrollmentFilterResult =
  | { filters: EnrollmentFilters; error: null }
  | { filters: null; error: 'invalid_filter' };

/** Filter state used to render the form when the submitted one was rejected. */
export const EMPTY_ENROLLMENT_FILTERS: EnrollmentFilters = { page: 1, status: '' };

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
 * Reads the `page` and `status` query parameters into the filter state.
 *
 * A `status` outside the backend vocabulary, or a `page` that is not a positive
 * integer, is reported as `invalid_filter` instead of being forwarded. The
 * academic service answers both with `400`, and a filter somebody typed by hand
 * should produce an explanation rather than a failed request. An absent or
 * empty parameter keeps its default, so a plain `/enrollments` visit and the
 * filter form's own submission both parse cleanly.
 */
export function parseEnrollmentFilters(
  input: Record<string, string | string[] | undefined>
): EnrollmentFilterResult {
  const rawPage = firstValue(input.page).trim();
  const rawStatus = firstValue(input.status).trim();

  if (rawPage !== '' && !/^[1-9]\d*$/.test(rawPage)) {
    return { filters: null, error: 'invalid_filter' };
  }

  let status: EnrollmentRecordStatus | '' = '';

  if (rawStatus !== '') {
    const parsed = enrollmentRecordStatusSchema.safeParse(rawStatus);

    if (!parsed.success) {
      return { filters: null, error: 'invalid_filter' };
    }

    status = parsed.data;
  }

  return {
    filters: { page: rawPage === '' ? 1 : Number(rawPage), status },
    error: null,
  };
}

/**
 * Query string for the academic enrollment list.
 *
 * `page_size` is always sent so the screen never silently falls back to the
 * service default of 20 rows if that default ever changes.
 */
export function enrollmentQueryString(filters: EnrollmentFilters): string {
  const params = new URLSearchParams({
    page: String(filters.page),
    page_size: String(ENROLLMENT_PAGE_SIZE),
  });

  if (filters.status) {
    params.set('status', filters.status);
  }

  return params.toString();
}

/**
 * Query string asking the billing service for the current payment of exactly
 * one enrollment.
 *
 * `page_size=1` is intentional: the repository orders transactions by
 * `created_at DESC`, so one row is the newest transaction, which is the one
 * that carries the current payment and reconciliation state. `page=1` is sent
 * because the handler applies `page_size` before validating `page`.
 */
export function transactionQueryString(enrollmentId: string): string {
  const params = new URLSearchParams({
    page: '1',
    page_size: '1',
    enrollment_id: enrollmentId,
  });

  return params.toString();
}

/** Query string for the tenant schedule list used to label enrollments. */
export function scheduleQueryString(): string {
  const params = new URLSearchParams({
    page: '1',
    page_size: String(MAX_PAGE_SIZE),
  });

  return params.toString();
}

/**
 * Link to this screen at another page, preserving the active status filter.
 *
 * `page=1` is omitted so the canonical first page stays a clean URL.
 */
export function enrollmentPageHref(page: number, filters: EnrollmentFilters): string {
  const params = new URLSearchParams();

  if (filters.status) {
    params.set('status', filters.status);
  }

  if (page > 1) {
    params.set('page', String(page));
  }

  const query = params.toString();

  return query ? `${TENANT_ENROLLMENTS_PATH}?${query}` : TENANT_ENROLLMENTS_PATH;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether an identifier taken from a response is a UUID.
 *
 * `GET /api/v1/billing/transactions` answers `400 Invalid enrollment_id` for a
 * value that is not a UUID. Enrollment ids come from the academic service and
 * always are, but a malformed one must degrade to "no payment to show" instead
 * of turning the whole page into an error state.
 */
export function isEnrollmentId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Indexes tenant schedules by id so an enrollment can be labelled by its
 * `schedule_id`. Entries without a usable id are skipped.
 */
export function schedulesById(schedules: readonly TenantSchedule[]): Map<string, TenantSchedule> {
  const index = new Map<string, TenantSchedule>();

  for (const schedule of schedules) {
    if (typeof schedule?.id === 'string' && schedule.id !== '') {
      index.set(schedule.id, schedule);
    }
  }

  return index;
}

/**
 * Picks the transaction that represents an enrollment's payment state.
 *
 * The lookup requests one row, so normally there is nothing to choose.
 * Migration `000002_payment_idempotency` made `transactions.enrollment_id`
 * unique, but `000003_subscription_renewals` dropped that index so an
 * enrollment can accumulate renewal transactions; the repository returns them
 * `created_at DESC`, which makes the first row the newest one. Reading the first
 * row keeps that decision explicit rather than relying on array order at the
 * call site.
 */
export function pickEnrollmentTransaction(
  transactions: readonly TransactionRecord[]
): TransactionRecord | undefined {
  return transactions.length > 0 ? transactions[0] : undefined;
}

/**
 * Full name of the student on an enrollment.
 *
 * The academic service serialises `Student.LastName` under the key
 * `lastå_name` (the documented typo), so both spellings are read the same way
 * `lib/students.ts::studentLastName` does on the parent surface.
 */
export function studentDisplayName(student: EnrollmentStudent | null | undefined): string {
  if (!student) {
    return 'Student';
  }

  const first = typeof student.first_name === 'string' ? student.first_name.trim() : '';
  const storedLast = typeof student.last_name === 'string' ? student.last_name.trim() : '';
  const typoLast = typeof student.lastå_name === 'string' ? student.lastå_name.trim() : '';
  const name = [first, storedLast || typoLast].filter(Boolean).join(' ');

  return name || 'Student';
}

/** Class name of an enrollment, or a neutral placeholder when it is missing. */
export function enrollmentClassName(enrollment: TenantEnrollment): string {
  const name = enrollment.class?.name;

  return typeof name === 'string' && name.trim() ? name.trim() : 'Kelas';
}

/**
 * Indonesian label of an enrollment status.
 *
 * An unknown value is shown verbatim rather than hidden: enrollment statuses
 * are written by both academic and billing workflows, so a state this screen has
 * not been taught about should be visible instead of being displayed as if it
 * were one of the known ones.
 */
export function enrollmentStatusLabel(status: string): string {
  const option = ENROLLMENT_STATUS_OPTIONS.find((candidate) => candidate.value === status);

  return option ? option.label : status;
}

const DAY_NAMES: readonly string[] = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];

/**
 * Label for the schedule attached to an enrollment, or `null` when there is
 * none to show.
 *
 * The format matches `lib/catalog.ts::scheduleLabels` so the same weekly slot
 * reads identically in the public catalog and on the tenant dashboard. Private
 * enrollments carry no `schedule_id`, and a schedule may be missing from the
 * fetched window, so both cases return `null` and the caller decides what to
 * display instead.
 */
export function scheduleLabel(schedule: TenantSchedule | undefined): string | null {
  if (!schedule) {
    return null;
  }

  const day =
    typeof schedule.day_of_week === 'number' ? DAY_NAMES[schedule.day_of_week - 1] : undefined;
  const start = typeof schedule.start_time === 'string' ? schedule.start_time.slice(0, 5) : '';
  const end = typeof schedule.end_time === 'string' ? schedule.end_time.slice(0, 5) : '';

  if (!day || !start || !end) {
    return null;
  }

  const label = `${day}, ${start}–${end}`;
  const location = typeof schedule.location === 'string' ? schedule.location.trim() : '';

  return location ? `${label} · ${location}` : label;
}

/**
 * Rupiah amount of a transaction, or the shared placeholder when there is none.
 *
 * The currency code is re-checked before formatting because `Intl.NumberFormat`
 * throws a `RangeError` on an empty or malformed currency, which would take the
 * whole page down over a formatting detail. `formatCurrency` already returns the
 * placeholder for a missing amount.
 */
export function transactionAmountLabel(transaction: TransactionRecord | undefined): string {
  if (!transaction) {
    return formatCurrency(undefined);
  }

  const currency =
    typeof transaction.currency === 'string' && transaction.currency.trim()
      ? transaction.currency.trim()
      : 'IDR';

  return formatCurrency(transaction.gross_amount, currency);
}

/** Pagination summary sentence for the result count line. */
export function enrollmentCountLabel(pagination: ListPagination): string {
  const total = pagination.total_items;

  return total === 1 ? '1 enrollment' : `${total} enrollment`;
}
