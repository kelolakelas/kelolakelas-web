import type { StudentSurnameFields } from './students';

/**
 * Weekly slot of a group enrollment, as returned by the academic service
 * (KEL-70). Absent for a private enrollment and for a schedule that no longer
 * exists, even when `schedule_id` is still set.
 */
export type EnrollmentScheduleSummary = {
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
};

export type EnrollmentRecord = {
  id: string;
  status: string;
  class?: { name?: string | null } | null;
  student?: ({ first_name?: string | null } & StudentSurnameFields) | null;
  joined_at?: string;
  schedule_id?: string | null;
  schedule?: EnrollmentScheduleSummary | null;
};

export type TransactionRecord = {
  id: string;
  enrollment_id: string;
  /** Duitku `merchantOrderId`: the transaction UUID, or `renewal-<uuid>` for a renewal invoice. */
  merchant_order_id?: string;
  status: string;
  gross_amount?: number;
  currency?: string;
  reconciliation_status?: string;
  reconciliation_last_error?: string;
  updated_at?: string;
  /** Present on checkout-backed transactions; old rows predate both fields. */
  checkout_session_url?: string;
  invoice_expires_at?: string;
  /**
   * Selected Duitku channel (KEL-125/126): `VC` card, `VA`/`BC` virtual
   * account, `SP`/`NQ` QRIS. Absent on rows written before KEL-125 and on
   * non-payable responses, where billing omits the field.
   */
  payment_method?: string;
  /** VA number from the provider inquiry; only emitted while payable. */
  va_number?: string;
  /** QRIS string from the provider inquiry; only emitted while payable. */
  qr_string?: string;
  /** Optional provider app URL accompanying a QRIS invoice. */
  app_url?: string;
};

export type PaymentPresentation = { label: string; detail: string; tone: 'neutral' | 'success' | 'danger' | 'warning' };

export function paymentPresentation(enrollment: EnrollmentRecord, transaction?: TransactionRecord): PaymentPresentation {
  // KEL-149: a suspended enrollment is parked by billing, not by its payment.
  // The invoice keeps its own state, so this branch runs before the payment
  // branches — otherwise a paid suspended enrollment would read as an
  // activation still in progress, which it is not.
  if (enrollment.status === 'suspended') {
    return {
      label: 'Ditangguhkan',
      detail: 'Enrollment ini sedang ditangguhkan penyelenggara. Riwayat pembayaran tetap tercatat dan status akan diperbarui bila enrollment dilanjutkan.',
      tone: 'warning',
    };
  }
  if (!transaction) return { label: 'Menunggu transaksi', detail: 'Enrollment belum memiliki transaksi pembayaran yang dapat ditampilkan.', tone: 'neutral' };
  if (transaction.reconciliation_status === 'reconciling') return { label: 'Pembayaran diterima, aktivasi diproses', detail: 'Pembayaran sudah diterima. Aktivasi enrollment sedang dicoba ulang oleh sistem.', tone: 'warning' };
  if (transaction.reconciliation_status === 'terminal_failed') return { label: 'Aktivasi perlu tindak lanjut', detail: 'Pembayaran diterima, tetapi aktivasi enrollment belum berhasil. Hubungi penyelenggara.', tone: 'danger' };
  if (transaction.status === 'paid' && enrollment.status === 'active') return { label: 'Aktif', detail: 'Pembayaran diterima dan enrollment telah aktif.', tone: 'success' };
  if (transaction.status === 'paid') return { label: 'Pembayaran diterima', detail: 'Pembayaran diterima; status enrollment akan diperbarui oleh backend.', tone: 'warning' };
  if (transaction.status === 'failed' || transaction.status === 'expired' || transaction.status === 'cancelled') return { label: transaction.status === 'expired' ? 'Kedaluwarsa' : 'Pembayaran gagal', detail: enrollment.status === 'active' ? 'Pembayaran ini tidak berhasil. Enrollment tetap tercatat aktif oleh backend.' : 'Enrollment belum aktif. Buat pembayaran baru hanya bila Anda ingin melanjutkan pendaftaran.', tone: 'danger' };
  return { label: 'Menunggu pembayaran', detail: 'Belum ada konfirmasi pembayaran dari provider. Status ini berasal dari backend.', tone: 'neutral' };
}

/**
 * Whether the backend state can still change on its own, without the parent
 * doing anything: the provider has not confirmed the payment yet, activation is
 * being retried, or billing accepted the payment and academic has not activated
 * the enrollment yet. Final states (active, failed, expired, cancelled,
 * refunded, terminal reconciliation failure) return false, which is what ends
 * the automatic refresh on the payment return page (KEL-44).
 */
export function paymentIsSettling(enrollment: EnrollmentRecord, transaction?: TransactionRecord): boolean {
  if (!transaction) return false;
  if (transaction.reconciliation_status === 'terminal_failed') return false;
  if (transaction.reconciliation_status === 'reconciling') return true;
  if (transaction.status === 'pending' || transaction.status === 'creating') return true;
  return transaction.status === 'paid' && enrollment.status === 'pending';
}

export function formatCurrency(amount?: number, currency = 'IDR') {
  return typeof amount === 'number' ? new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount) : 'Nominal belum tersedia';
}

/** URL protocols a checkout link may use; anything else is refused before render. */
const ALLOWED_CHECKOUT_PROTOCOLS = ['http:', 'https:'];

/** Provider app links are rendered as anchors, so they get the same scheme gate as checkout links. */
function allowedHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Human-readable channel for the "Metode" row (KEL-127).
 *
 * Codes come from the billing allowlist (KEL-125): `VC` card, `VA`/`BC`
 * virtual account, `SP`/`NQ` QRIS. Null when the row predates the field, so
 * old transactions show no method rather than a guessed one. An unknown
 * non-empty code is shown raw: hiding what the backend recorded would mislead
 * more than an unfamiliar label.
 */
export function paymentChannelLabel(transaction?: TransactionRecord): string | null {
  switch (transaction?.payment_method) {
    case 'VC': return 'Kartu';
    case 'VA':
    case 'BC': return 'Virtual Account';
    case 'SP':
    case 'NQ': return 'QRIS';
    default: break;
  }
  return typeof transaction?.payment_method === 'string' && transaction.payment_method !== '' ? transaction.payment_method : null;
}

export type PaymentInstructions =
  | { kind: 'va'; channelLabel: string; vaNumber: string; expiresLabel: string }
  | { kind: 'qris'; channelLabel: string; qrString: string; appUrl: string | null; expiresLabel: string };

/**
 * In-page payment instructions for a transaction, or null when none may be
 * shown (KEL-127).
 *
 * Billing only emits `va_number`/`qr_string` while the invoice is payable
 * (pending with a live expiry, KEL-126), and the render-time checks below
 * repeat that judgment so a stale row can never paint usable instructions:
 * non-`pending` status, missing or passed expiry, and a channel that does not
 * match the instruction kind all refuse. Card (`VC`) transactions never yield
 * instructions — the parent pays them on the hosted provider page.
 *
 * The QR string is returned verbatim from the backend; the caller must render
 * it as an image and never synthesize one from anything else.
 */
export function paymentInstructionsView(transaction?: TransactionRecord, now: Date = new Date()): PaymentInstructions | null {
  if (transaction?.status !== 'pending') return null;
  if (!transaction.invoice_expires_at) return null;
  const expiresAt = new Date(transaction.invoice_expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return null;
  const method = transaction.payment_method;
  if ((method === 'VA' || method === 'BC') && typeof transaction.va_number === 'string' && transaction.va_number !== '') {
    return { kind: 'va', channelLabel: 'Virtual Account', vaNumber: transaction.va_number, expiresLabel: formatExpiry(expiresAt) };
  }
  if ((method === 'SP' || method === 'NQ') && typeof transaction.qr_string === 'string' && transaction.qr_string !== '') {
    return { kind: 'qris', channelLabel: 'QRIS', qrString: transaction.qr_string, appUrl: allowedHttpUrl(transaction.app_url), expiresLabel: formatExpiry(expiresAt) };
  }
  return null;
}

export type ResumePayment = { url: string; expiresLabel: string };

/**
 * Renders the data for the "Lanjutkan pembayaran" link on the parent enrollment
 * screen, or null when the link must not be shown.
 *
 * The link exists only to let a parent finish a payment that is still waiting
 * on the provider, so every refusal below removes a case where following it
 * could not succeed or could not be trusted: a non-`pending` transaction, a
 * missing expiry (old rows predate the field), an invoice that already expired
 * at render time, or a `checkout_session_url` whose scheme is not http(s).
 * Expiry is judged against server time while the page renders; the payment
 * provider stays the final authority if the invoice lapses seconds later.
 */
export function resumePayment(transaction?: TransactionRecord, now: Date = new Date()): ResumePayment | null {
  if (transaction?.status !== 'pending') return null;
  if (!transaction.invoice_expires_at) return null;
  const expiresAt = new Date(transaction.invoice_expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) return null;
  if (typeof transaction.checkout_session_url !== 'string' || transaction.checkout_session_url === '') return null;
  let url: URL;
  try {
    url = new URL(transaction.checkout_session_url);
  } catch {
    return null;
  }
  if (!ALLOWED_CHECKOUT_PROTOCOLS.includes(url.protocol)) return null;
  return { url: url.toString(), expiresLabel: formatExpiry(expiresAt) };
}

/** Human-readable deadline shown next to the resume-payment link. */
export function formatExpiry(expiresAt: Date): string {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(expiresAt);
}
