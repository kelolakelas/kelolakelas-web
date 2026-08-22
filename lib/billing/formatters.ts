export function formatTransactionAmount(amount: number | null | undefined, currency = 'IDR'): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Nominal tidak tersedia';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatTransactionDate(value?: string | null): string {
  if (!value) return 'Belum tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Belum tersedia';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function getTransactionStatus(status: string): 'pending' | 'paid' | 'failed' | 'canceled' | 'unknown' {
  const normalized = status.toLowerCase();
  if (normalized === 'paid' || normalized === 'success' || normalized === 'settlement') return 'paid';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'canceled';
  if (normalized === 'pending') return 'pending';
  return 'unknown';
}

export const transactionStatusLabels = { pending: 'Menunggu pembayaran', paid: 'Berhasil', failed: 'Gagal', canceled: 'Dibatalkan', unknown: 'Status tidak tersedia' } as const;