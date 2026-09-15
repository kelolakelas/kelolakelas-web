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
