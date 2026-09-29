import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()), cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT'); }) }));

const getCheckoutInstructions = vi.fn();
vi.mock('@/lib/payment-instructions', () => ({ getCheckoutInstructions: (input: unknown) => getCheckoutInstructions(input) }));

const { enrollInClass } = await import('./actions');
const { cookies } = await import('next/headers');
const { redirect } = await import('next/navigation');

const id = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const token = `header.${Buffer.from(JSON.stringify({ user_id: id, is_parent: true })).toString('base64url')}.signature`;
const savedGateway = process.env.GATEWAY_API_URL;

function form(payment_method: string) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ student_id: id, billing_cycle: 'monthly', schedule_id: '', idempotency_key: id, payment_method })) data.set(key, value);
  return data;
}

function respondWith(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

function success() {
  respondWith(201, { status: 'success', data: { enrollment: { id }, payment: { checkout_session_url: 'https://checkout.example.test/session' } } });
}

beforeEach(() => {
  process.env.GATEWAY_API_URL = 'http://gateway.test';
  vi.mocked(cookies).mockReset().mockResolvedValue({ get: () => ({ value: token }) } as never);
  vi.mocked(redirect).mockClear();
  getCheckoutInstructions.mockReset();
});

afterEach(() => {
  if (savedGateway === undefined) delete process.env.GATEWAY_API_URL;
  else process.env.GATEWAY_API_URL = savedGateway;
  vi.unstubAllGlobals();
});

describe('enrollInClass payment channel routing (KEL-127)', () => {
  it.each(['VA', 'NQ'] as const)('keeps %s on KelolaKelas with scoped backend instructions', async (channel) => {
    success();
    const instructions = channel === 'VA'
      ? { kind: 'va', channelLabel: 'Virtual Account', vaNumber: '88001234', expiresLabel: '30 Sep 2026' }
      : { kind: 'qris', channelLabel: 'QRIS', qrString: '000201010212123QRIS', appUrl: null, expiresLabel: '30 Sep 2026' };
    getCheckoutInstructions.mockResolvedValue({ data: { channel, merchantOrderId: id, amount: 150000, currency: 'IDR', instructions, qrImage: null }, error: null });
    const state = await enrollInClass(id, { success: false, message: '' }, form(channel));
    expect(state.success).toBe(true);
    expect(state.payment?.instructions).toEqual(instructions);
    expect(getCheckoutInstructions).toHaveBeenCalledWith({ enrollmentId: id });
    expect(redirect).not.toHaveBeenCalled();
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(request?.body))).toMatchObject({ payment_method: channel });
  });

  it('redirects card checkout to the provider without reading card details', async () => {
    success();
    await expect(enrollInClass(id, { success: false, message: '' }, form('VC'))).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('https://checkout.example.test/session');
    expect(getCheckoutInstructions).not.toHaveBeenCalled();
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(request?.body))).toMatchObject({ payment_method: 'VC' });
    expect(String(request?.body)).not.toMatch(/card_number|cvv|cvc/i);
  });

  it('does not show VA instructions for a same-key replay of a card invoice', async () => {
    success();
    getCheckoutInstructions.mockResolvedValue({ data: { channel: 'VC', merchantOrderId: id, instructions: null, qrImage: null }, error: null });
    await expect(enrollInClass(id, { success: false, message: '' }, form('VA'))).rejects.toThrow('REDIRECT');
    expect(redirect).toHaveBeenCalledWith('https://checkout.example.test/session');
  });

  it('uses a safe fallback when the instruction row has not appeared yet', async () => {
    success();
    getCheckoutInstructions.mockResolvedValue({ data: { channel: '', merchantOrderId: null, instructions: null, qrImage: null }, error: null });
    const state = await enrollInClass(id, { success: false, message: '' }, form('NQ'));
    expect(state.success).toBe(true);
    expect(state.payment?.instructions).toBeNull();
  });

  it.each(['forbidden', 'api'] as const)('reports a %s billing lookup without exposing a payment panel', async (error) => {
    success();
    getCheckoutInstructions.mockResolvedValue({ data: null, error, message: 'Instruksi pembayaran belum dapat dimuat.' });
    const state = await enrollInClass(id, { success: false, message: '' }, form('VA'));
    expect(state.success).toBe(false);
    expect(state.payment).toBeUndefined();
  });

  it('rejects an unknown channel before creating an enrollment', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const state = await enrollInClass(id, { success: false, message: '' }, form('OV'));
    expect(state.success).toBe(false);
    expect(state.errors?.payment_method).toBeDefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([401, 403])('rejects %i before reading any instructions', async (status) => {
    respondWith(status, { status: 'error' });
    const state = await enrollInClass(id, { success: false, message: '' }, form('NQ'));
    expect(state.success).toBe(false);
    expect(state.payment).toBeUndefined();
    expect(getCheckoutInstructions).not.toHaveBeenCalled();
  });
});
