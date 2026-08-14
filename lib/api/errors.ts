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

export type ApiErrorCode = 'missing_authorization' | 'token_expired' | 'token_invalid' | 'permission_denied' | 'validation_error' | 'not_found' | 'server_error' | 'unknown';

export function getApiErrorCode(status: number, message?: string): ApiErrorCode {
  const normalizedMessage = message?.toLowerCase() || '';
  if (status === 401 && normalizedMessage.includes('expired')) return 'token_expired';
  if (status === 401 && (normalizedMessage.includes('invalid') || normalizedMessage.includes('malformed'))) return 'token_invalid';
  if (status === 401 && (normalizedMessage.includes('authorization') || normalizedMessage.includes('bearer'))) return 'missing_authorization';
  if (status === 401) return 'token_invalid';
  if (status === 403) return 'permission_denied';
  if (status === 404) return 'not_found';
  if (status === 400 || status === 422) return 'validation_error';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

export function getSafeApiMessage(status: number, message?: string, code = getApiErrorCode(status, message)): string {
  if (code === 'missing_authorization') return 'Request tidak memiliki Authorization. Silakan masuk kembali.';
  if (code === 'token_expired') return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
  if (code === 'token_invalid') return 'Token autentikasi tidak valid. Silakan masuk kembali.';
  if (status === 403) return 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
  if (status === 404) return 'Data yang diminta tidak ditemukan.';
  if (status === 400) return message || 'Data yang dikirim belum valid.';
  if (status === 409) return 'Operasi ditolak karena data bertentangan dengan kondisi saat ini.';
  if (status === 422) return message || 'Data yang dikirim belum valid.';
  if (status >= 500) return 'Layanan sedang bermasalah. Silakan coba lagi nanti.';
  return message || 'Permintaan tidak dapat diproses.';
}