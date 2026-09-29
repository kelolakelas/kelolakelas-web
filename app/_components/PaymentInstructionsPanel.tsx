'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatCurrency, paymentChannelLabel, type PaymentInstructions } from '@/lib/payment-status';

export const CHECKOUT_INSTRUCTIONS_FALLBACK_TEXT = 'Instruksi pembayaran belum tersedia. Muat ulang halaman ini atau buka riwayat enrollment untuk status terbaru.';

/**
 * In-page VA/QRIS instructions read back from billing (KEL-127).
 *
 * Everything shown comes from the backend transaction: the VA number is
 * printed verbatim and the QR payload is rendered from the backend's
 * `qr_string` only. The caller computes `instructions` with
 * `paymentInstructionsView`, which already refuses non-pending, expired, and
 * channel-mismatched rows, so a stale row can never paint usable
 * instructions here. Nothing card-like is ever rendered — card checkouts keep
 * the provider redirect — and no card detail input exists anywhere in this
 * component.
 *
 * `statusHref` is the page that owns the live status for this payment (the
 * return page while settling); the panel itself never refreshes. The button
 * below links to it so the parent can watch the payment settle.
 */
export function PaymentInstructionsPanel({
  instructions,
  channel,
  merchantOrderId,
  amount,
  currency,
  qrImage,
  statusHref,
  expiresAt,
}: {
  instructions: PaymentInstructions | null;
  /** Raw channel code for the "Metode" label; unknown codes show raw. */
  channel?: string | null;
  /** `merchant_order_id` of the payment whose instructions this panel shows. */
  merchantOrderId?: string | null;
  amount?: number;
  currency?: string;
  /** Server-rendered QR image for `instructions.qrString`, if encodable. */
  qrImage?: string | null;
  /** Where the "check status" action points, if the caller knows one. */
  statusHref?: string | null;
  /** Backend deadline; the browser hides instructions when it passes. */
  expiresAt?: string | null;
}) {
  const [expiredDeadline, setExpiredDeadline] = useState<string | null>(null);
  useEffect(() => {
    if (!instructions || !expiresAt) return;
    const deadline = new Date(expiresAt).getTime();
    if (!Number.isFinite(deadline)) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) setExpiredDeadline(expiresAt);
      else timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    timer = setTimeout(check, Math.max(0, Math.min(deadline - Date.now(), 2_147_483_647)));
    document.addEventListener('visibilitychange', check);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', check); };
  }, [instructions, expiresAt]);

  if (!instructions || !expiresAt || expiredDeadline === expiresAt) {
    return (
      <div className="rounded-2xl border border-[#dfe3d7] bg-[#f6f8f3] p-4" role="status">
        <p className="text-sm text-[#52615b]">{CHECKOUT_INSTRUCTIONS_FALLBACK_TEXT}</p>
        <Link href="/dashboard/parent/enrollments" className="mt-2 inline-block text-sm font-bold text-[#617c35] underline">
          Lihat riwayat enrollment
        </Link>
      </div>
    );
  }

  const channelLabel = (typeof channel === 'string' && channel !== '' ? paymentChannelLabel({ id: '', enrollment_id: '', status: '', payment_method: channel }) : null) ?? instructions.channelLabel;

  return (
    <div className="rounded-2xl border border-[#cfdcc3] bg-[#f4f8ec] p-4 sm:p-5" aria-live="polite">
      <p className="text-sm font-bold uppercase tracking-[.14em] text-[#617c35]">Instruksi pembayaran · {channelLabel}</p>
      {merchantOrderId && <p className="mt-1 text-sm text-[#52615b]">Nomor pesanan: <span className="font-semibold">{merchantOrderId}</span></p>}
      <p className="mt-1 text-sm text-[#52615b]">Nominal: <span className="font-semibold">{formatCurrency(amount, currency)}</span></p>

      {instructions.kind === 'va' ? (
        <div className="mt-3 rounded-xl bg-white p-4">
          <p className="text-sm text-[#65726c]">Nomor Virtual Account</p>
          <p className="mt-1 text-2xl font-black tracking-wide" data-testid="va-number">{instructions.vaNumber}</p>
          <p className="mt-2 text-sm text-[#52615b]">Bayar ke nomor di atas dari bank atau e-banking Anda sebelum {instructions.expiresLabel}.</p>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-white p-4">
          {qrImage ? (
            // The QR image encodes the backend's qr_string verbatim; alt text
            // carries the payload for screen readers instead of a generated
            // description.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrImage} alt={`Kode QR pembayaran: ${instructions.qrString}`} width={256} height={256} className="h-64 w-64" data-testid="qris-image" />
          ) : (
            <p className="text-sm text-[#52615b]">
              Kode QR tidak dapat ditampilkan sebagai gambar. Gunakan string QR berikut pada aplikasi pembayaran Anda: <span className="font-mono break-all" data-testid="qris-string">{instructions.qrString}</span>
            </p>
          )}
          {qrImage && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-bold text-[#617c35]">Tidak dapat memindai? Lihat string QR</summary>
              <p className="mt-1 font-mono text-xs break-all text-[#52615b]" data-testid="qris-string">{instructions.qrString}</p>
            </details>
          )}
          {instructions.appUrl && (
            <p className="mt-2 text-sm text-[#52615b]">
              Atau buka aplikasi pembayaran: <a href={instructions.appUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#617c35] underline">Buka aplikasi pembayaran</a>
            </p>
          )}
          <p className="mt-2 text-sm text-[#52615b]">Pindai sebelum {instructions.expiresLabel}.</p>
        </div>
      )}

      <p className="mt-3 text-sm font-semibold text-[#365047]">Selesaikan pembayaran sebelum {instructions.expiresLabel}.</p>
      {statusHref && (
        <Link href={statusHref} className="mt-2 inline-block rounded-xl bg-[#617c35] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#54682d]">
          Periksa status pembayaran
        </Link>
      )}
    </div>
  );
}
