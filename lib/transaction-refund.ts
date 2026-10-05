/**
 * Shared decision logic for recording a manual full refund from the tenant
 * transaction list (KEL-153).
 *
 * A Server Action module may only export async functions, so everything the
 * tests need to pin lives here: which rows may offer the action, where the
 * request goes, and what a refused refund tells the member. The backends
 * remain the authority on every rule.
 *
 * Backend contract (billing service, proxied unchanged by the gateway):
 *
 * - `POST /api/v1/billing/transactions/{id}/refund` (guarded by
 *   `billing:refund` for tenant members) records transfer evidence as
 *   `{ "reason", "transfer_reference" }` — both required — and moves a `paid`
 *   transaction to `refunded`. A transaction that is not `paid` is refused
 *   with `409`; enrollment termination is retried asynchronously.
 * - No partial refunds and no parent notification: both are out of scope.
 */

/** Permission that gates the refund action; rows hide it entirely without this. */
export const TRANSACTION_REFUND_PERMISSION = 'billing:refund';

/**
 * Only a settled-as-paid transaction can be refunded. Billing refuses every
 * other status with `409`, so the control is not offered where the request
 * would certainly fail. An already-`refunded` row must never offer the action
 * again.
 */
export const REFUNDABLE_TRANSACTION_STATUS = 'paid';

export type TransactionRefundState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export const EMPTY_TRANSACTION_REFUND_STATE: TransactionRefundState = {
  status: 'idle',
  message: '',
};

export const TRANSACTION_REFUND_SUCCESS_MESSAGE =
  'Refund tercatat. Transaksi ini sekarang berstatus refunded.';

export const INVALID_TRANSACTION_ID_MESSAGE = 'ID transaksi tidak valid.';

export const EMPTY_REFUND_REASON_MESSAGE = 'Alasan refund wajib diisi.';

export const EMPTY_REFUND_REFERENCE_MESSAGE = 'Referensi transfer wajib diisi.';

const SESSION_EXPIRED_MESSAGE =
  'Sesi Anda sudah berakhir. Silakan masuk kembali untuk mencatat refund.';

const FORBIDDEN_MESSAGE =
  'Anda tidak memiliki izin mencatat refund. Hubungi administrator tenant untuk mendapatkan permission billing:refund.';

const NOT_FOUND_MESSAGE =
  'Transaksi tidak ditemukan pada tenant Anda. Muat ulang halaman ini.';

const CONFLICT_MESSAGE =
  'Transaksi ini sudah tidak dapat di-refund (kemungkinan sudah di-refund atau statusnya berubah). Muat ulang halaman untuk melihat status terbaru.';

const INVALID_REQUEST_MESSAGE =
  'Permintaan refund tidak valid. Periksa alasan dan referensi transfer lalu coba lagi.';

const SERVICE_UNAVAILABLE_MESSAGE =
  'Layanan refund sedang tidak tersedia, sehingga refund belum dapat diproses. Coba lagi sebentar lagi.';

const FALLBACK_MESSAGE = 'Refund belum dapat diproses. Coba lagi nanti.';

/** Whether the refund action may be offered for a transaction row. */
export function canRefundTransaction(status: string): boolean {
  return status === REFUNDABLE_TRANSACTION_STATUS;
}

/** Whether the member's permission set includes the refund permission. */
export function hasRefundPermission(permissions: readonly string[]): boolean {
  return permissions.includes(TRANSACTION_REFUND_PERMISSION);
}

/** Path the gateway proxies to the billing refund endpoint. */
export function transactionRefundRequestPath(transactionId: string): string {
  return `/api/v1/billing/transactions/${transactionId}/refund`;
}

/**
 * Accepts the identifier shape the billing endpoint parses as a UUID.
 *
 * The browser submits the identifier as a hidden form field, so it is
 * untrusted input: a value that is not a UUID is rejected before any request
 * is made rather than being forwarded to the backend as a 400.
 */
export function isRefundableTransactionId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/**
 * Maps a refused refund onto what the tenant member is told.
 *
 * `409` is the interesting state and is reported in full: it means another
 * member already refunded the transaction or its status changed, which has a
 * different next step (reload) than an outage. Server errors are deliberately
 * replaced rather than passed through, because the billing handler answers a
 * `500` with a raw Go error text that must not reach a member's screen.
 */
export function transactionRefundErrorMessage(
  status: number,
  backendMessage?: string | null
): string {
  if (status === 401) return SESSION_EXPIRED_MESSAGE;
  if (status === 403) return FORBIDDEN_MESSAGE;
  if (status === 404) return NOT_FOUND_MESSAGE;
  if (status === 409) return CONFLICT_MESSAGE;
  if (status === 400) return INVALID_REQUEST_MESSAGE;
  if (status === 503) return SERVICE_UNAVAILABLE_MESSAGE;
  if (status >= 500) return FALLBACK_MESSAGE;

  const trimmed = backendMessage?.trim();
  return trimmed ? trimmed : FALLBACK_MESSAGE;
}
