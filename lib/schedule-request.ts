import { z } from 'zod';
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
 * - GET /api/v1/schedule-requests[?status=] (parent-scoped list)
 * - POST /api/v1/schedule-requests/{id}/cancel (parent, pending only)
 *
 * Every response is `{status, data}`. A request carries id, class_id,
 * student_id, billing_cycle, slots, note, status
 * (pending/approved/rejected/cancelled), rejection_reason and decided_at.
 * Rejecting is a tenant action and stays out of scope: the web only displays
 * the reason.
 */

export const SCHEDULE_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

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
  decided_at?: string | null;
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
  cancelled: 'Dibatalkan',
};

export function scheduleRequestStatusLabel(status: string): string {
  return (STATUS_LABELS as Record<string, string>)[status] || status;
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
        decided_at: typeof record.decided_at === 'string' ? record.decided_at : null,
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
