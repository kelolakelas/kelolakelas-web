import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentReturnResult } from '../_queries/queries';

/**
 * Render test for the payment return landing (KEL-44).
 *
 * The page is a Server Component, so its query is mocked and the markup is
 * asserted, as in the enrollment history page test. What matters is that the
 * status shown is the backend's, whatever the provider put in the redirect, and
 * that only a settling status mounts the automatic refresh.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const getPaymentReturnStatus = vi.fn<(id: string) => Promise<PaymentReturnResult>>();
vi.mock('../_queries/queries', () => ({ getPaymentReturnStatus: (id: string) => getPaymentReturnStatus(id) }));

const { default: PaymentReturnPage } = await import('./page');

const ORDER_ID = '2d8f7a0c-7a0a-4aa8-8e54-000000000001';
const AUTO_REFRESH_TEXT = 'Status diperbarui otomatis';

function backend(enrollmentStatus: string, transaction: Record<string, unknown>): PaymentReturnResult {
  return {
    data: {
      enrollment: { id: 'enrollment-1', status: enrollmentStatus, class: { name: 'Matematika Dasar' }, student: { first_name: 'Budi' } },
      transaction: { id: ORDER_ID, merchant_order_id: ORDER_ID, enrollment_id: 'enrollment-1', status: 'pending', gross_amount: 150000, currency: 'IDR', ...transaction },
    },
    error: null,
  };
}

async function render(query: Record<string, string | string[] | undefined>): Promise<string> {
  return renderToStaticMarkup(await PaymentReturnPage({ searchParams: Promise.resolve(query) }));
}

beforeEach(() => {
  getPaymentReturnStatus.mockReset();
});

describe('payment return landing (KEL-44)', () => {
  it('shows a pending payment and keeps refreshing it', async () => {
    getPaymentReturnStatus.mockResolvedValue(backend('pending', { status: 'pending' }));

    const html = await render({ merchantOrderId: ORDER_ID });

    expect(getPaymentReturnStatus).toHaveBeenCalledWith(ORDER_ID);
    expect(html).toContain('Menunggu pembayaran');
    expect(html).toContain('Matematika Dasar');
    expect(html).toContain(AUTO_REFRESH_TEXT);
  });

  it('shows the paid and active result once the backend reports it, and stops refreshing', async () => {
    getPaymentReturnStatus.mockResolvedValue(backend('active', { status: 'paid', reconciliation_status: 'active' }));

    const html = await render({ merchantOrderId: ORDER_ID });

    expect(html).toContain('Aktif');
    expect(html).toContain('enrollment telah aktif');
    expect(html).not.toContain(AUTO_REFRESH_TEXT);
  });

  it('never shows success from the provider resultCode while the backend is still pending', async () => {
    getPaymentReturnStatus.mockResolvedValue(backend('pending', { status: 'pending' }));

    const html = await render({ merchantOrderId: ORDER_ID, resultCode: '00', reference: 'REF-SUCCESS' });

    expect(html).toContain('Menunggu pembayaran');
    expect(html).not.toContain('enrollment telah aktif');
    expect(html).not.toContain('REF-SUCCESS');
  });

  it('shows a failure from the backend even when the redirect claims success', async () => {
    getPaymentReturnStatus.mockResolvedValue(backend('pending', { status: 'failed' }));

    const html = await render({ merchantOrderId: ORDER_ID, resultCode: '00' });

    expect(html).toContain('Pembayaran gagal');
    expect(html).not.toContain(AUTO_REFRESH_TEXT);
  });

  it.each([
    ['reconciling', backend('pending', { status: 'paid', reconciliation_status: 'reconciling' }), 'aktivasi diproses', true],
    ['paid but not yet active', backend('pending', { status: 'paid' }), 'Pembayaran diterima', true],
    ['expired', backend('pending', { status: 'expired' }), 'Kedaluwarsa', false],
    ['terminal activation failure', backend('pending', { status: 'paid', reconciliation_status: 'terminal_failed' }), 'Aktivasi perlu tindak lanjut', false],
  ])('shows the %s state from the backend', async (_label, result, text, refreshing) => {
    getPaymentReturnStatus.mockResolvedValue(result);

    const html = await render({ merchantOrderId: ORDER_ID });

    expect(html).toContain(text);
    expect(html.includes(AUTO_REFRESH_TEXT)).toBe(refreshing);
  });

  it.each([
    ['missing', {}],
    ['repeated', { merchantOrderId: [ORDER_ID, ORDER_ID] }],
    ['a LIKE wildcard', { merchantOrderId: '%' }],
    ['markup', { merchantOrderId: '<script>alert(1)</script>' }],
  ])('rejects a %s merchantOrderId without calling the backend', async (_label, query) => {
    const html = await render(query);

    expect(getPaymentReturnStatus).not.toHaveBeenCalled();
    expect(html).toContain('Tautan pembayaran tidak valid.');
    expect(html).not.toContain('<script>');
  });

  it('reports an unknown or foreign order without any enrollment detail', async () => {
    getPaymentReturnStatus.mockResolvedValue({ data: null, error: 'not_found', message: 'Pembayaran ini tidak ditemukan pada akun Anda.' });

    const html = await render({ merchantOrderId: ORDER_ID });

    expect(html).toContain('Pembayaran tidak ditemukan.');
    expect(html).not.toContain(AUTO_REFRESH_TEXT);
  });

  it('keeps retrying a transient backend error within the refresh window', async () => {
    getPaymentReturnStatus.mockResolvedValue({ data: null, error: 'api', message: 'Status pembayaran belum dapat dimuat dari server.' });

    const html = await render({ merchantOrderId: ORDER_ID });

    expect(html).toContain('Status pembayaran belum dapat dimuat.');
    expect(html).toContain(AUTO_REFRESH_TEXT);
  });

  it('does not retry a forbidden answer', async () => {
    getPaymentReturnStatus.mockResolvedValue({ data: null, error: 'forbidden', message: 'Anda tidak memiliki akses.' });

    const html = await render({ merchantOrderId: ORDER_ID });

    expect(html).toContain('Akses ditolak.');
    expect(html).not.toContain(AUTO_REFRESH_TEXT);
  });

  it('shows VA instructions from the scoped backend row on refresh', async () => {
    getPaymentReturnStatus.mockResolvedValue(backend('pending', { payment_method: 'VA', va_number: '88001234', invoice_expires_at: '2100-01-01T00:00:00Z' }));
    const html = await render({ merchantOrderId: ORDER_ID });
    expect(html).toContain('88001234');
    expect(html).toContain('Nomor pesanan');
    expect(html).toContain(ORDER_ID);
    expect(html).toContain('Virtual Account');
    expect(html).not.toContain('Buka halaman pembayaran kartu');
  });

  it('renders the backend QR payload as an image and keeps the raw payload accessible', async () => {
    getPaymentReturnStatus.mockResolvedValue(backend('pending', { payment_method: 'NQ', qr_string: '000201010212123QRIS', invoice_expires_at: '2100-01-01T00:00:00Z' }));
    const html = await render({ merchantOrderId: ORDER_ID });
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('000201010212123QRIS');
    expect(html).toContain('Tidak dapat memindai?');
  });

  it('shows a safe fallback when pending QR instructions are absent', async () => {
    getPaymentReturnStatus.mockResolvedValue(backend('pending', { payment_method: 'NQ', invoice_expires_at: '2100-01-01T00:00:00Z' }));
    const html = await render({ merchantOrderId: ORDER_ID });
    expect(html).toContain('Instruksi pembayaran belum tersedia');
    expect(html).not.toContain('data:image/png;base64,');
  });

  it('never displays stale VA details after the payment expires', async () => {
    getPaymentReturnStatus.mockResolvedValue(backend('pending', { status: 'expired', payment_method: 'VA', va_number: '88001234', invoice_expires_at: '2000-01-01T00:00:00Z' }));
    const html = await render({ merchantOrderId: ORDER_ID });
    expect(html).toContain('Kedaluwarsa');
    expect(html).not.toContain('88001234');
  });
});
