export type EnrollmentRecord = {
  id: string;
  status: string;
  class?: { name?: string | null } | null;
  student?: { first_name?: string | null; last_name?: string | null; lastå_name?: string | null } | null;
  joined_at?: string;
};

export type TransactionRecord = {
  id: string;
  enrollment_id: string;
  status: string;
  gross_amount?: number;
  currency?: string;
  reconciliation_status?: string;
  reconciliation_last_error?: string;
  updated_at?: string;
  /** Present on checkout-backed transactions; old rows predate both fields. */
  checkout_session_url?: string;
  invoice_expires_at?: string;
};

export type PaymentPresentation = { label: string; detail: string; tone: 'neutral' | 'success' | 'danger' | 'warning' };

export function paymentPresentation(enrollment: EnrollmentRecord, transaction?: TransactionRecord): PaymentPresentation {
  if (!transaction) return { label: 'Menunggu transaksi', detail: 'Enrollment belum memiliki transaksi pembayaran yang dapat ditampilkan.', tone: 'neutral' };
  if (transaction.reconciliation_status === 'reconciling') return { label: 'Pembayaran diterima, aktivasi diproses', detail: 'Pembayaran sudah diterima. Aktivasi enrollment sedang dicoba ulang oleh sistem.', tone: 'warning' };
  if (transaction.reconciliation_status === 'terminal_failed') return { label: 'Aktivasi perlu tindak lanjut', detail: 'Pembayaran diterima, tetapi aktivasi enrollment belum berhasil. Hubungi penyelenggara.', tone: 'danger' };
  if (transaction.status === 'paid' && enrollment.status === 'active') return { label: 'Aktif', detail: 'Pembayaran diterima dan enrollment telah aktif.', tone: 'success' };
  if (transaction.status === 'paid') return { label: 'Pembayaran diterima', detail: 'Pembayaran diterima; status enrollment akan diperbarui oleh backend.', tone: 'warning' };
  if (transaction.status === 'failed' || transaction.status === 'expired' || transaction.status === 'cancelled') return { label: transaction.status === 'expired' ? 'Kedaluwarsa' : 'Pembayaran gagal', detail: 'Enrollment belum aktif. Buat pembayaran baru hanya bila Anda ingin melanjutkan pendaftaran.', tone: 'danger' };
  return { label: 'Menunggu pembayaran', detail: 'Belum ada konfirmasi pembayaran dari provider. Status ini berasal dari backend.', tone: 'neutral' };
}

export function formatCurrency(amount?: number, currency = 'IDR') {
  return typeof amount === 'number' ? new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount) : 'Nominal belum tersedia';
}

/** URL protocols a checkout link may use; anything else is refused before render. */
const ALLOWED_CHECKOUT_PROTOCOLS = ['http:', 'https:'];

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
