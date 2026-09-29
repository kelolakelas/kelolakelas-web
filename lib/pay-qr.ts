import QRCode from 'qrcode';

/**
 * QR payload rendered on the server as a data URL (KEL-127).
 *
 * `qr_string` from billing may be a raw QRIS payload or a URL (e.g. a hosted
 * QR image); the backend is the source of truth either way, so no prefix is
 * ever added or stripped here. A QR that fails to encode is reported as null
 * and the caller falls back to showing the raw string for manual use.
 */
export async function qrDataUrl(payload: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 256 });
  } catch {
    return null;
  }
}
