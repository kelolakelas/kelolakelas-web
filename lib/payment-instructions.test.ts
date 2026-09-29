import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const { getCheckoutInstructions } = await import('./payment-instructions');
const { cookies } = await import('next/headers');

const enrollmentId = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const foreignEnrollmentId = '7c2e4d1b-5b8f-4d2e-8d3f-7a1c9e6b4f22';
const expiry = '2100-01-01T00:00:00Z';
const savedGateway = process.env.GATEWAY_API_URL;

function respondWith(status: number, data: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(data), { status })));
}

function list(rows: unknown[]) {
  respondWith(200, { status: 'success', data: { items: rows, pagination: { page: 1, page_size: 20, total_items: rows.length, total_pages: 1 } } });
}

beforeEach(() => {
  process.env.GATEWAY_API_URL = 'http://gateway.test';
  vi.mocked(cookies).mockReset().mockResolvedValue({ get: () => ({ value: 'session-token' }) } as never);
});

afterEach(() => {
  if (savedGateway === undefined) delete process.env.GATEWAY_API_URL;
  else process.env.GATEWAY_API_URL = savedGateway;
  vi.unstubAllGlobals();
});

describe('getCheckoutInstructions (KEL-127)', () => {
  it('reads only parent-scoped VA rows and returns backend details for in-page payment', async () => {
    list([
      { id: foreignEnrollmentId, enrollment_id: foreignEnrollmentId, merchant_order_id: foreignEnrollmentId, status: 'pending', payment_method: 'VA', va_number: '999999', invoice_expires_at: expiry },
      { id: enrollmentId, enrollment_id: enrollmentId, merchant_order_id: enrollmentId, status: 'pending', payment_method: 'VA', va_number: '88001234', gross_amount: 150000, currency: 'IDR', invoice_expires_at: expiry },
    ]);
    const result = await getCheckoutInstructions({ enrollmentId });
    expect(result.error).toBeNull();
    expect(result.data?.instructions).toMatchObject({ kind: 'va', vaNumber: '88001234' });
    expect(result.data?.amount).toBe(150000);
    expect(result.data?.merchantOrderId).toBe(enrollmentId);
    expect(result.data?.qrImage).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      `http://gateway.test/api/v1/billing/transactions?enrollment_id=${enrollmentId}&page=1&page_size=20`,
      expect.objectContaining({ cache: 'no-store', headers: { Accept: 'application/json', Authorization: 'Bearer session-token' } })
    );
  });

  it('renders a QR from the backend QR string and never from an app URL', async () => {
    list([{ id: enrollmentId, enrollment_id: enrollmentId, merchant_order_id: enrollmentId, status: 'pending', payment_method: 'NQ', qr_string: '000201010212123QRIS', app_url: 'https://app.example.test/pay', invoice_expires_at: expiry }]);
    const result = await getCheckoutInstructions({ enrollmentId });
    expect(result.error).toBeNull();
    expect(result.data?.instructions).toMatchObject({ kind: 'qris', qrString: '000201010212123QRIS', appUrl: 'https://app.example.test/pay' });
    expect(result.data?.qrImage).toMatch(/^data:image\/png;base64,/);
  });

  it('does not expose another enrollment even if the list is unexpectedly broad', async () => {
    list([{ id: foreignEnrollmentId, enrollment_id: foreignEnrollmentId, merchant_order_id: foreignEnrollmentId, status: 'pending', payment_method: 'VA', va_number: '999999', invoice_expires_at: expiry }]);
    const result = await getCheckoutInstructions({ enrollmentId });
    expect(result.error).toBeNull();
    expect(result.data?.instructions).toBeNull();
  });

  it('rejects a partial merchant-order match from the billing search filter', async () => {
    list([{ id: foreignEnrollmentId, enrollment_id: foreignEnrollmentId, merchant_order_id: foreignEnrollmentId, status: 'pending', payment_method: 'VA', va_number: '999999', invoice_expires_at: expiry }]);
    const result = await getCheckoutInstructions({ merchantOrderId: enrollmentId });
    expect(result.error).toBeNull();
    expect(result.data?.instructions).toBeNull();
  });

  it.each([401, 403])('propagates %i as a forbidden answer without showing payment data', async (status) => {
    respondWith(status, { status: 'error', message: 'forbidden' });
    const result = await getCheckoutInstructions({ enrollmentId });
    expect(result).toMatchObject({ data: null, error: 'forbidden' });
  });

  it('keeps a missing row as a safe fallback but distinguishes an API outage', async () => {
    list([]);
    expect((await getCheckoutInstructions({ enrollmentId })).data?.instructions).toBeNull();
    respondWith(503, { status: 'error' });
    expect(await getCheckoutInstructions({ enrollmentId })).toMatchObject({ data: null, error: 'api' });
  });

  it('rejects a forged enrollment identifier without calling billing', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const result = await getCheckoutInstructions({ enrollmentId: '%_invalid' });
    expect(result).toMatchObject({ data: null, error: 'api' });
    expect(spy).not.toHaveBeenCalled();
  });
});
