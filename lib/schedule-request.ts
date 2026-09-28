import { z } from 'zod';
import { PLATFORM_FEE_EXCEEDS_GROSS_CODE, platformFeeRejectedState } from './enrollment';
import { WEEKDAY_NAMES } from './enrollment-schedule';

/**
 * Private-class schedule request (KEL-109).
 *
 * A parent proposes weekly slots for a private class from the class detail
 * page instead of going through checkout. The backend contract below already
 * merged via KEL-107; the web client only mirrors it and must not invent
 * fields:
 *
 * - POST /api/v1/catalog/classes/{class_id}/schedule-requests (201)
 *   body {student_id, billing_cycle, slots, note}
 * - GET /api/v1/schedule-requests[?status=] (caller-scoped list: the parent
 *   sees only their own rows, a tenant member sees only their tenant's rows)
 * - POST /api/v1/schedule-requests/{id}/cancel (parent, pending only)
 *
 * KEL-110 adds the tenant decision side (guard `enrollment:update`):
 *
 * - POST /api/v1/schedule-requests/{id}/approve (pending only) answers 200
 *   `{status, data: {enrollment, payment: {transaction_id,
 *   checkout_session_url, gross_amount, status}}}`. Refusals: 403 (no
 *   permission), 404 (unknown id), 409 (no longer pending: cancelled by the
 *   parent or decided by another member), 422 (billing refused the invoice,
 *   including the `platform_fee_exceeds_gross` case KEL-106 already handles
 *   for enrollments).
 * - POST /api/v1/schedule-requests/{id}/reject body {reason? max 2000,
 *   recommended_slots?: [{day_of_week ISO 1-7, start_time, end_time}]}
 *   answers 200 with the updated request. The same 403/404/409 refusals
 *   apply. Slot validation matches the create contract.
 *
 * KEL-116 adds the recommendation round-trip (guard `enrollment:update` for
 * the tenant side, parent ownership for the parent side):
 *
 * - A rejection carrying `recommended_slots` keeps the request `rejected`
 *   but with the tenant's alternative slots attached; list/detail expose
 *   `recommended_slots` alongside `rejection_reason`.
 * - POST /api/v1/schedule-requests/{id}/recommendation/accept (owning
 *   parent only) answers 200 with the same approval checkout shape as
 *   approve: `{status, data: {enrollment, payment: {transaction_id,
 *   checkout_session_url, gross_amount, status}}}`. Refusals: 403 (not the
 *   owner), 404 (unknown id), 409 (already accepted, declined, or
 *   otherwise moved on), 422 (billing refused the invoice, including the
 *   `platform_fee_exceeds_gross` case).
 * - POST /api/v1/schedule-requests/{id}/recommendation/decline (owning
 *   parent only) moves the row to `declined`; a later accept answers 409.
 *
 * Every response is `{status, data}`. A request carries id, class_id,
 * student_id, billing_cycle, slots, note, status
 * (pending/approved/rejected/declined/cancelled), rejection_reason,
 * recommended_slots and decided_at.
 * Tenant rows additionally carry tenant_id, parent_id, parent_email and
 * created_at. On the parent surface the tenant's reason is display-only;
 * deciding (approve/reject) happens on the tenant dashboard (KEL-110).
 */

export const SCHEDULE_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'declined', 'cancelled'] as const;

export type ScheduleRequestStatus = (typeof SCHEDULE_REQUEST_STATUSES)[number];

export type ScheduleRequestSlot = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

export type ScheduleRequest = {
  id: string;
  class_id: string;
  student_id: string;
  billing_cycle: 'monthly' | 'quarterly' | 'yearly';
  slots: ScheduleRequestSlot[];
  note?: string | null;
  status: ScheduleRequestStatus;
  rejection_reason?: string | null;
  /**
   * Tenant-proposed alternative slots attached by a rejection with a
   * recommendation (KEL-116). Present only on `rejected` rows whose
   * rejection carried slots; absent everywhere else.
   */
  recommended_slots?: ScheduleRequestSlot[];
  decided_at?: string | null;
  /**
   * Tenant-scoped rows (KEL-110): the parent list never carries these, so
   * every key stays optional and is read defensively at runtime.
   */
  tenant_id?: string | null;
  parent_id?: string | null;
  parent_email?: string | null;
  created_at?: string | null;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const scheduleRequestSlotSchema = z.object({
  day_of_week: z
    .number()
    .int('Hari slot harus antara Senin (1) sampai Minggu (7).')
    .min(1, 'Hari slot harus antara Senin (1) sampai Minggu (7).')
    .max(7, 'Hari slot harus antara Senin (1) sampai Minggu (7).'),
  start_time: z.string().regex(TIME_PATTERN, 'Jam mulai harus dalam format JJ:MM.'),
  end_time: z.string().regex(TIME_PATTERN, 'Jam selesai harus dalam format JJ:MM.'),
}).refine((slot) => slot.end_time > slot.start_time, {
  message: 'Jam selesai harus setelah jam mulai.',
  path: ['end_time'],
});

export const scheduleRequestFormSchema = z.object({
  student_id: z.string().uuid('Pilih student yang valid.'),
  billing_cycle: z.enum(['monthly', 'quarterly', 'yearly'], { message: 'Pilih periode pembayaran.' }),
  slots: z.array(scheduleRequestSlotSchema).min(1, 'Tambahkan minimal satu slot jadwal.'),
  note: z.string().max(2000, 'Catatan maksimal 2000 karakter.').optional(),
});

export type ScheduleRequestFormInput = z.infer<typeof scheduleRequestFormSchema>;

export function scheduleRequestPayload(input: ScheduleRequestFormInput) {
  const note = input.note?.trim();
  return {
    student_id: input.student_id,
    billing_cycle: input.billing_cycle,
    slots: input.slots.map((slot) => ({
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
    })),
    ...(note ? { note } : {}),
  };
}

/** Raw slot values as typed in the form; day arrives as a string from <select>. */
export type ScheduleSlotDraft = {
  day_of_week: string;
  start_time: string;
  end_time: string;
};

/**
 * Client-side slot check that runs before any request is sent (KEL-109
 * acceptance: a slot whose end is not after its start is rejected in the form).
 * Returns the first Indonesian error message, or null when every slot is valid.
 * It reuses the server-side schema so both sides agree on what is valid.
 */
export function validateScheduleSlotDrafts(drafts: ScheduleSlotDraft[]): string | null {
  if (!drafts.length) return 'Tambahkan minimal satu slot jadwal.';
  for (const draft of drafts) {
    const parsed = scheduleRequestSlotSchema.safeParse({
      day_of_week: Number(draft.day_of_week),
      start_time: draft.start_time,
      end_time: draft.end_time,
    });
    if (!parsed.success) return parsed.error.issues[0]?.message || 'Slot jadwal tidak valid.';
  }
  return null;
}

/**
 * One-line label for a requested slot, e.g. `Senin, 16:00–17:30`, reusing the
 * Indonesian weekday names from KEL-70. Network data is re-checked; a malformed
 * slot never renders a guessed label.
 */
export function scheduleSlotLabel(slot: Partial<ScheduleRequestSlot> | null | undefined): string | null {
  const day =
    typeof slot?.day_of_week === 'number' && Number.isInteger(slot.day_of_week)
      ? WEEKDAY_NAMES[slot.day_of_week - 1]
      : undefined;
  const start = typeof slot?.start_time === 'string' ? slot.start_time.slice(0, 5) : '';
  const end = typeof slot?.end_time === 'string' ? slot.end_time.slice(0, 5) : '';
  if (!day || !start || !end) return null;
  return `${day}, ${start}–${end}`;
}

const STATUS_LABELS: Record<ScheduleRequestStatus, string> = {
  pending: 'Menunggu peninjauan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  declined: 'Rekomendasi ditolak',
  cancelled: 'Dibatalkan',
};

export function scheduleRequestStatusLabel(status: string): string {
  return (STATUS_LABELS as Record<string, string>)[status] || status;
}

/**
 * Keeps only well-formed recommended slots from a network row (KEL-116).
 *
 * The day must be an ISO integer 1–7 and both times strings; anything else
 * is dropped rather than rendered as a guessed label. Times longer than
 * `HH:MM` (the backend stores `HH:MM:SS`) pass through untouched — the
 * display helper only reads the first five characters. Absent or empty
 * input normalizes to `undefined` so the UI can tell "no recommendation"
 * apart from "a recommendation with no usable slot".
 */
export function normalizeRecommendedSlots(value: unknown): ScheduleRequestSlot[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const slots = value.flatMap((item): ScheduleRequestSlot[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.day_of_week !== 'number' || !Number.isInteger(record.day_of_week)) return [];
    if (record.day_of_week < 1 || record.day_of_week > 7) return [];
    if (typeof record.start_time !== 'string' || typeof record.end_time !== 'string') return [];
    if (record.start_time === '' || record.end_time === '') return [];
    return [{ day_of_week: record.day_of_week, start_time: record.start_time, end_time: record.end_time }];
  });
  return slots.length > 0 ? slots : undefined;
}

/**
 * Backend time format for a validated slot draft (KEL-116).
 *
 * The academic service parses times strictly as `HH:MM:SS`, while the web
 * form inputs (`<input type="time">`) and the zod schema work in `HH:MM`.
 * A validated draft is therefore expanded with `:00` when it carries only
 * two parts, mirroring the tenant class-schedule payload. Unknown shapes
 * pass through untouched so a malformed value fails loudly at the backend
 * instead of being silently rewritten.
 */
export function scheduleRequestTimeForBackend(value: string): string {
  return value.split(':').length === 2 ? `${value}:00` : value;
}

export type ScheduleRecommendationStatus = 'none' | 'pending' | 'accepted' | 'declined';

const RECOMMENDATION_STATUS_LABELS: Record<Exclude<ScheduleRecommendationStatus, 'none'>, string> = {
  pending: 'Menunggu keputusan parent',
  accepted: 'Rekomendasi diterima',
  declined: 'Rekomendasi ditolak parent',
};

/**
 * Where a tenant's recommendation stands from the reader's side (KEL-116).
 *
 * - `declined` rows: the parent turned the recommendation down.
 * - `approved` rows with slots attached: the parent accepted the
 *   recommendation (acceptance moves through the same purchase path as an
 *   approval, so the row reads approved).
 * - `rejected` rows with slots attached: the recommendation still waits.
 * - anything else: no recommendation involved.
 */
export function scheduleRecommendationStatus(request: Pick<ScheduleRequest, 'status' | 'recommended_slots'>): ScheduleRecommendationStatus {
  if (!request.recommended_slots || request.recommended_slots.length === 0) return 'none';
  if (request.status === 'declined') return 'declined';
  if (request.status === 'approved') return 'accepted';
  if (request.status === 'rejected') return 'pending';
  return 'none';
}

/** Indonesian label of a non-`none` recommendation status; null when there is none. */
export function scheduleRecommendationStatusLabel(status: ScheduleRecommendationStatus): string | null {
  if (status === 'none') return null;
  return RECOMMENDATION_STATUS_LABELS[status];
}

/** Whether a rejected-with-recommendation row still awaits the parent's decision. */
export function hasPendingRecommendation(request: Pick<ScheduleRequest, 'status' | 'recommended_slots'>): boolean {
  return request.status === 'rejected' && !!request.recommended_slots && request.recommended_slots.length > 0;
}

/** Keeps only records the list UI can render; malformed rows are dropped, never thrown on. */
export function normalizeScheduleRequests(value: unknown): ScheduleRequest[] {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : [];
  return items.flatMap((item): ScheduleRequest[] => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.class_id !== 'string' || typeof record.student_id !== 'string') return [];
    if (!(SCHEDULE_REQUEST_STATUSES as readonly string[]).includes(record.status as string)) return [];
    const slots = Array.isArray(record.slots) ? (record.slots as ScheduleRequestSlot[]) : [];
    return [
      {
        id: record.id,
        class_id: record.class_id,
        student_id: record.student_id,
        billing_cycle:
          record.billing_cycle === 'quarterly' || record.billing_cycle === 'yearly' ? record.billing_cycle : 'monthly',
        slots,
        note: typeof record.note === 'string' ? record.note : null,
        status: record.status as ScheduleRequestStatus,
        rejection_reason: typeof record.rejection_reason === 'string' ? record.rejection_reason : null,
        recommended_slots: normalizeRecommendedSlots(record.recommended_slots),
        decided_at: typeof record.decided_at === 'string' ? record.decided_at : null,
        tenant_id: typeof record.tenant_id === 'string' ? record.tenant_id : null,
        parent_id: typeof record.parent_id === 'string' ? record.parent_id : null,
        parent_email: typeof record.parent_email === 'string' ? record.parent_email : null,
        created_at: typeof record.created_at === 'string' ? record.created_at : null,
      },
    ];
  });
}

/** Requests of this parent that belong to the class being viewed. */
export function selectRequestsForClass(requests: ScheduleRequest[], classId: string): ScheduleRequest[] {
  return requests.filter((request) => request.class_id === classId);
}

/**
 * Minimal shape an enrollment row needs so an approved request can link to the
 * parent enrollment screen (KEL-53). EnrollmentRecord does not declare
 * student/class ids, but the backend rows may still carry them, so every key is
 * read defensively at runtime.
 */
export type EnrollmentLinkCandidate = {
  id: string;
  student_id?: unknown;
  class_id?: unknown;
  student?: { id?: unknown } | null;
  class?: { id?: unknown } | null;
};

/** Matches an approved request to its enrollment via student + class; null when no row matches. */
export function findMatchingEnrollment(
  request: Pick<ScheduleRequest, 'student_id' | 'class_id'>,
  enrollments: EnrollmentLinkCandidate[]
): { id: string } | null {
  const match = enrollments.find((enrollment) => {
    const studentId = typeof enrollment.student_id === 'string' ? enrollment.student_id : typeof enrollment.student?.id === 'string' ? enrollment.student.id : null;
    const classId = typeof enrollment.class_id === 'string' ? enrollment.class_id : typeof enrollment.class?.id === 'string' ? enrollment.class.id : null;
    return studentId === request.student_id && classId === request.class_id;
  });
  return match ? { id: match.id } : null;
}

/** Anchor of the request list on the class detail page; duplicate errors link here. */
export function scheduleRequestListAnchor(classId: string): string {
  return `/kelas/${classId}#daftar-permintaan-jadwal`;
}

export const DUPLICATE_SCHEDULE_REQUEST_MESSAGE =
  'Permintaan sebelumnya untuk student ini masih menunggu peninjauan. Lihat daftar permintaan di bawah sebelum mengirim yang baru.';

const PARENT_SESSION_MESSAGE = 'Hanya parent yang login dapat mengajukan permintaan jadwal.';
const NOT_FOUND_MESSAGE = 'Kelas atau student tidak ditemukan. Muat ulang halaman lalu coba lagi.';
const VALIDATION_MESSAGE = 'Permintaan jadwal tidak dapat diproses. Periksa student, periode, dan slot Anda.';
const UNAVAILABLE_MESSAGE = 'Layanan permintaan jadwal sedang tidak tersedia. Coba lagi nanti.';

/**
 * Maps a refused schedule-request call onto what the parent is told.
 *
 * Any 409 on create means the backend kept an earlier pending request: the
 * contract's duplicate case, so it always carries the duplicate message with a
 * link to the list rather than a generic conflict. Server errors are replaced,
 * never passed through.
 */
export function scheduleRequestErrorMessage(status: number, backendMessage?: string | null): string {
  if (status === 401 || status === 403) return PARENT_SESSION_MESSAGE;
  if (status === 404) return NOT_FOUND_MESSAGE;
  if (status === 409) return DUPLICATE_SCHEDULE_REQUEST_MESSAGE;
  if (status === 400 || status === 422) return VALIDATION_MESSAGE;
  if (status >= 500) return UNAVAILABLE_MESSAGE;
  const trimmed = backendMessage?.trim();
  return trimmed ? trimmed : UNAVAILABLE_MESSAGE;
}

const CANCEL_NOT_FOUND_MESSAGE = 'Permintaan jadwal ini tidak ditemukan pada akun Anda. Muat ulang halaman ini.';
const CANCEL_CONFLICT_MESSAGE =
  'Permintaan ini sudah tidak dapat dibatalkan karena statusnya sudah berubah. Muat ulang halaman untuk melihat status terbaru.';

/** Maps a refused schedule-request cancellation onto what the parent is told. */
export function scheduleRequestCancelErrorMessage(status: number, backendMessage?: string | null): string {
  if (status === 401 || status === 403) return PARENT_SESSION_MESSAGE;
  if (status === 404) return CANCEL_NOT_FOUND_MESSAGE;
  if (status === 409) return CANCEL_CONFLICT_MESSAGE;
  if (status === 400) return 'Permintaan pembatalan tidak valid. Muat ulang halaman lalu coba lagi.';
  if (status >= 500) return 'Pembatalan permintaan jadwal belum dapat diproses. Coba lagi nanti.';
  const trimmed = backendMessage?.trim();
  return trimmed ? trimmed : 'Pembatalan permintaan jadwal belum dapat diproses. Coba lagi nanti.';
}

const DECISION_PERMISSION_MESSAGE =
  'Anda tidak memiliki izin memproses permintaan jadwal ini. Hubungi administrator tenant untuk mendapatkan permission enrollment:update.';
const DECISION_NOT_FOUND_MESSAGE = 'Permintaan jadwal ini tidak ditemukan pada tenant Anda. Muat ulang halaman ini.';
const DECISION_CONFLICT_MESSAGE =
  'Permintaan ini sudah tidak dapat diproses karena statusnya sudah berubah (dibatalkan parent atau diproses anggota lain). Muat ulang halaman untuk melihat status terbaru.';
const DECISION_VALIDATION_MESSAGE = 'Permintaan ini tidak dapat diproses. Muat ulang halaman lalu coba lagi.';
const DECISION_UNAVAILABLE_MESSAGE = 'Layanan permintaan jadwal sedang tidak tersedia. Coba lagi nanti.';

/**
 * Maps a refused tenant approve/reject call onto what the member is told
 * (KEL-110).
 *
 * 401/403 always mean the caller lacks `enrollment:update`, so they read as a
 * permission state, never as a technical failure. 409 means the row left
 * `pending` while the dialog was open: the parent cancelled it, or another
 * member decided it first. A 422 carrying the KEL-106 machine-readable code
 * reuses the platform-fee wording the tenant already knows from checkout;
 * any other refusal body is replaced, never passed through.
 */
export function scheduleRequestDecisionErrorMessage(
  status: number,
  backendMessage?: string | null,
  code?: string | null
): string {
  if (status === 401 || status === 403) return DECISION_PERMISSION_MESSAGE;
  if (status === 404) return DECISION_NOT_FOUND_MESSAGE;
  if (status === 409) return DECISION_CONFLICT_MESSAGE;
  if (status === 422 && code === PLATFORM_FEE_EXCEEDS_GROSS_CODE) return platformFeeRejectedState.message;
  if (status === 400 || status === 422) return DECISION_VALIDATION_MESSAGE;
  if (status >= 500) return DECISION_UNAVAILABLE_MESSAGE;
  const trimmed = backendMessage?.trim();
  return trimmed ? trimmed : DECISION_UNAVAILABLE_MESSAGE;
}

const RECOMMENDATION_SESSION_MESSAGE = 'Hanya parent pemilik permintaan yang login dapat memproses rekomendasi ini.';
const RECOMMENDATION_NOT_FOUND_MESSAGE = 'Rekomendasi jadwal ini tidak ditemukan pada akun Anda. Muat ulang halaman ini.';
const RECOMMENDATION_CONFLICT_MESSAGE =
  'Rekomendasi ini sudah tidak dapat diproses karena statusnya sudah berubah (sudah diterima, ditolak, atau diproses ulang). Muat ulang halaman untuk melihat status terbaru.';
const RECOMMENDATION_VALIDATION_MESSAGE = 'Rekomendasi ini tidak dapat diproses. Muat ulang halaman lalu coba lagi.';
const RECOMMENDATION_UNAVAILABLE_MESSAGE = 'Layanan rekomendasi jadwal sedang tidak tersedia. Coba lagi nanti.';

/**
 * Maps a refused parent accept/decline call onto what the parent is told
 * (KEL-116).
 *
 * The accept path shares the approval purchase flow, so a 422 carrying the
 * KEL-106 machine-readable code reuses the platform-fee wording; any other
 * refusal body is replaced, never passed through. 409 means the row left
 * the actionable state while the parent was deciding: the recommendation
 * was already accepted or declined, or the request moved on.
 */
export function scheduleRecommendationDecisionErrorMessage(
  status: number,
  backendMessage?: string | null,
  code?: string | null
): string {
  if (status === 401 || status === 403) return RECOMMENDATION_SESSION_MESSAGE;
  if (status === 404) return RECOMMENDATION_NOT_FOUND_MESSAGE;
  if (status === 409) return RECOMMENDATION_CONFLICT_MESSAGE;
  if (status === 422 && code === PLATFORM_FEE_EXCEEDS_GROSS_CODE) return platformFeeRejectedState.message;
  if (status === 400 || status === 422) return RECOMMENDATION_VALIDATION_MESSAGE;
  if (status >= 500) return RECOMMENDATION_UNAVAILABLE_MESSAGE;
  const trimmed = backendMessage?.trim();
  return trimmed ? trimmed : RECOMMENDATION_UNAVAILABLE_MESSAGE;
}

/**
 * Usable checkout URL from an approve answer, or null when it must not be
 * shown (KEL-110).
 *
 * The approve payment carries no expiry field, so unlike `resumePayment` there
 * is no liveness check here: only the http(s) scheme gate applies, and a
 * non-URL value never renders a guessed link.
 */
export function scheduleRequestPaymentLink(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export type ScheduleRequestApprovePayment = {
  url: string;
  grossAmount: number | null;
};

/**
 * Reads the `{enrollment, payment}` payload of a successful approve call.
 *
 * Returns null when the payment side is missing or its checkout URL is not
 * usable: the dialog then confirms the approval without rendering a link
 * rather than showing a broken one.
 */
export function normalizeApprovePayment(data: unknown): ScheduleRequestApprovePayment | null {
  if (!data || typeof data !== 'object') return null;
  const payment = (data as { payment?: unknown }).payment;
  if (!payment || typeof payment !== 'object') return null;
  const url = scheduleRequestPaymentLink((payment as { checkout_session_url?: unknown }).checkout_session_url);
  if (!url) return null;
  const grossAmount = (payment as { gross_amount?: unknown }).gross_amount;
  return { url, grossAmount: typeof grossAmount === 'number' ? grossAmount : null };
}
