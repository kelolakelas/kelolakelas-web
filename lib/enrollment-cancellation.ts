/**
 * Shared decision logic for cancelling a pending enrollment from the parent
 * enrollment screen.
 *
 * A Server Action module may only export async functions, so everything the
 * tests need to pin lives here: which enrollments may offer the action, where
 * the request goes, and what a refused cancellation tells the parent. The
 * backends remain the authority on every rule. The predicate below mirrors the
 * refusal table in [ADR 0016] — only a `pending` enrollment can be cancelled,
 * and a `pending` enrollment whose invoice was already paid is refused by
 * billing — so the control is not offered where the request would certainly
 * fail.
 *
 * [ADR 0016]: kelolakelas-docs/docs/adr/0016-cancel-pending-enrollment.md
 */

import type { EnrollmentRecord, TransactionRecord } from './payment-status';

/** Route the parent enrollment screen revalidates after a successful cancel. */
export const ENROLLMENT_CANCELLATION_PATH = '/dashboard/parent/enrollments';

/** Only an enrollment that has not started can be withdrawn by its parent. */
export const CANCELLABLE_ENROLLMENT_STATUS = 'pending';

/**
 * Transaction statuses that make a `pending` enrollment non-cancellable.
 *
 * Billing refuses to withdraw an invoice that was already settled, so a
 * `pending` enrollment whose newest transaction is `paid` (or `refunded`)
 * answers 409. The enrollment is still `pending` in that case because the
 * activation has not been applied yet, which is exactly the state a parent
 * must not be invited to cancel.
 */
export const SETTLED_TRANSACTION_STATUSES: readonly string[] = ['paid', 'refunded'];

export type EnrollmentCancellationState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export const EMPTY_ENROLLMENT_CANCELLATION_STATE: EnrollmentCancellationState = {
  status: 'idle',
  message: '',
};

export const ENROLLMENT_CANCELLATION_SUCCESS_MESSAGE =
  'Pendaftaran berhasil dibatalkan dan kursinya sudah dilepas.';

export const INVALID_ENROLLMENT_ID_MESSAGE = 'ID enrollment tidak valid.';

export const PARENT_SESSION_MESSAGE =
  'Sesi parent tidak valid. Silakan login kembali untuk membatalkan pendaftaran.';

const SESSION_EXPIRED_MESSAGE =
  'Sesi Anda sudah berakhir. Silakan masuk kembali untuk membatalkan pendaftaran.';

const PARENT_ONLY_MESSAGE =
  'Hanya akun parent yang dapat membatalkan pendaftarannya sendiri.';

const NOT_FOUND_MESSAGE =
  'Pendaftaran ini tidak ditemukan pada akun Anda. Muat ulang halaman ini.';

const CONFLICT_MESSAGE =
  'Pendaftaran ini tidak dapat dibatalkan karena pembayarannya sudah diterima atau statusnya sudah berubah. Muat ulang halaman untuk melihat status terbaru.';

const INVALID_REQUEST_MESSAGE =
  'Permintaan pembatalan tidak valid. Muat ulang halaman lalu coba lagi.';

const AUTH_UNAVAILABLE_MESSAGE =
  'Layanan otorisasi sedang tidak tersedia, sehingga pembatalan belum dapat diproses. Coba lagi sebentar lagi.';

const FALLBACK_MESSAGE =
  'Pembatalan enrollment belum dapat diproses. Coba lagi nanti.';

/**
 * Whether the cancel action may be offered for an enrollment.
 *
 * A settled transaction blocks the action even while the enrollment is still
 * `pending`, because billing is the service that decides whether the invoice
 * can still be withdrawn and its answer for that case is a refusal.
 */
export function canCancelEnrollment(
  enrollment: Pick<EnrollmentRecord, 'status'>,
  transaction?: Pick<TransactionRecord, 'status'> | null
): boolean {
  if (enrollment.status !== CANCELLABLE_ENROLLMENT_STATUS) return false;
  if (!transaction) return true;
  return !SETTLED_TRANSACTION_STATUSES.includes(transaction.status);
}

/** Path the gateway proxies to the academic cancellation endpoint. */
export function enrollmentCancellationRequestPath(enrollmentId: string): string {
  return `/api/v1/enrollments/${enrollmentId}/cancel`;
}

/**
 * Accepts the identifier shape the academic endpoint parses as a UUID.
 *
 * The browser submits the identifier as a hidden form field, so it is untrusted
 * input: a value that is not a UUID is rejected before any request is made
 * rather than being forwarded to the backend as a 400.
 */
export function isCancelableEnrollmentId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/**
 * Maps a refused cancellation onto what the parent is told.
 *
 * `409` is the interesting state and is reported in full: it means the backend
 * decided the enrollment can no longer be withdrawn, which is a different
 * situation from an outage and has a different next step. `401`/`403` separate
 * an expired session from a non-parent caller. Server errors are deliberately
 * replaced rather than passed through, because the academic handler answers a
 * `500` with the raw Go error text, which must not reach a parent's screen.
 */
export function enrollmentCancellationErrorMessage(
  status: number,
  backendMessage?: string | null
): string {
  if (status === 401) return SESSION_EXPIRED_MESSAGE;
  if (status === 403) return PARENT_ONLY_MESSAGE;
  if (status === 404) return NOT_FOUND_MESSAGE;
  if (status === 409) return CONFLICT_MESSAGE;
  if (status === 400) return INVALID_REQUEST_MESSAGE;
  if (status === 503) return AUTH_UNAVAILABLE_MESSAGE;
  if (status >= 500) return FALLBACK_MESSAGE;

  const trimmed = backendMessage?.trim();
  return trimmed ? trimmed : FALLBACK_MESSAGE;
}
