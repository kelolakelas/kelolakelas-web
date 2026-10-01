import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeListEnvelope } from '@/lib/list-envelope';
import { qrDataUrl } from '@/lib/pay-qr';
import { paymentInstructionsView, pickLatestTransaction, type PaymentInstructions, type TransactionRecord } from '@/lib/payment-status';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Serializable checkout instructions returned to the browser (KEL-127).
 *
 * `instructions` is null when no payable instruction row exists yet — the
 * panel then renders its safe fallback instead of failing. The QR image is
 * encoded server-side from the backend's `qr_string` only.
 */
export type CheckoutInstructions = {
  channel: string;
  merchantOrderId: string | null;
  amount?: number;
  currency?: string;
  /** Raw backend deadline so the client can hide stale instructions on time. */
  expiresAt?: string;
  instructions: PaymentInstructions | null;
  qrImage: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readTransactionList(path: string, token: string): Promise<TransactionRecord[] | null> {
  const response = await fetch(`${getGatewayBaseUrl()}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (response.status === 401 || response.status === 403) throw { forbidden: true };
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok || !isRecord(body) || body.status !== 'success') return null;
  return normalizeListEnvelope<TransactionRecord>(body.data).items;
}

/**
 * Reads the newest transaction for an enrollment (or a single merchant order)
 * and returns the panel payload (KEL-127).
 *
 * Read immediately after checkout so VA/QR details appear without a redirect.
 * The lookup goes through the parent-scoped billing list, so only the
 * signed-in parent's rows are visible. Billing's `enrollment_id` filter is an
 * exact UUID match; the `search` filter is a substring match, so a merchant
 * order lookup additionally requires an exact `merchant_order_id` match —
 * the same rule `getPaymentReturnStatus` applies.
 *
 * A missing row is not an error — the instruction write can lag the 201, and
 * the panel degrades to its fallback. Genuine 401/403 and backend outages
 * are still errors: a checkout-success page with a silent empty panel would
 * look like a broken payment.
 */
export async function getCheckoutInstructions(input: { enrollmentId?: string; merchantOrderId?: string }): Promise<
  | { data: CheckoutInstructions; error: null }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string }
> {
  const { enrollmentId, merchantOrderId } = input;
  const byEnrollment = typeof enrollmentId === 'string' && UUID_PATTERN.test(enrollmentId);
  const byOrder = typeof merchantOrderId === 'string' && UUID_PATTERN.test(merchantOrderId);
  if (!byEnrollment && !byOrder) {
    return { data: null, error: 'api', message: 'ID pembayaran tidak valid.' };
  }
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value || '';
    const path = byEnrollment
      ? `/api/v1/billing/transactions?enrollment_id=${encodeURIComponent(enrollmentId as string)}&page=1&page_size=20`
      : `/api/v1/billing/transactions?search=${encodeURIComponent(merchantOrderId as string)}&page=1&page_size=20`;
    let rows: TransactionRecord[] | null;
    try {
      rows = await readTransactionList(path, token);
    } catch (error) {
      if (isRecord(error) && error.forbidden === true) {
        return { data: null, error: 'forbidden', message: 'Anda tidak memiliki akses ke pembayaran enrollment ini. Masuk kembali dengan akun parent yang melakukan pembayaran.' };
      }
      throw error;
    }
    if (!rows) return { data: null, error: 'api', message: 'Instruksi pembayaran belum dapat dimuat dari server.' };
    const match = byEnrollment
      ? rows.filter((item) => item.enrollment_id === enrollmentId)
      : rows.filter((item) => item.merchant_order_id === merchantOrderId);
    if (!match.length) {
      return { data: { channel: '', merchantOrderId: merchantOrderId ?? null, instructions: null, qrImage: null }, error: null };
    }
    const newest = pickLatestTransaction(match);
    if (!newest) {
      return { data: { channel: '', merchantOrderId: merchantOrderId ?? null, instructions: null, qrImage: null }, error: null };
    }
    const instructions = paymentInstructionsView(newest);
    return {
      data: {
        channel: typeof newest.payment_method === 'string' ? newest.payment_method : '',
        merchantOrderId: newest.merchant_order_id ?? merchantOrderId ?? null,
        amount: newest.gross_amount,
        currency: newest.currency,
        expiresAt: newest.invoice_expires_at,
        instructions,
        qrImage: instructions?.kind === 'qris' ? await qrDataUrl(instructions.qrString) : null,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: 'configuration', message: getGatewayConfigurationErrorMessage(error) || 'Layanan instruksi pembayaran sedang tidak tersedia. Coba lagi nanti.' };
  }
}
