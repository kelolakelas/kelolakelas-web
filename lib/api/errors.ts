export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getSafeApiMessage(status: number, message?: string): string {
  if (status === 401) return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
  if (status === 403) return 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
  if (status === 404) return 'Data yang diminta tidak ditemukan.';
  if (status === 409) return 'Operasi ditolak karena data bertentangan dengan kondisi saat ini.';
  if (status === 422) return message || 'Data yang dikirim belum valid.';
  if (status >= 500 && process.env.NODE_ENV === 'development' && message) return message;
  if (status >= 500) return 'Layanan sedang bermasalah. Silakan coba lagi nanti.';
  return message || 'Permintaan tidak dapat diproses.';
}