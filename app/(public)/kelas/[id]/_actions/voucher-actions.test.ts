import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()), cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT'); }) }));
const { enrollInClass, previewClassVoucher } = await import('./actions');
const { cookies } = await import('next/headers');
const { voucherRejectedState } = await import('@/lib/enrollment');
const id = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const token = `header.${Buffer.from(JSON.stringify({ user_id: id, is_parent: true })).toString('base64url')}.signature`;
const savedGateway = process.env.GATEWAY_API_URL;
beforeEach(() => {
  process.env.GATEWAY_API_URL = 'http://gateway.test';
  vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: token }) } as never);
});
afterEach(() => {
  if (savedGateway === undefined) delete process.env.GATEWAY_API_URL;
  else process.env.GATEWAY_API_URL = savedGateway;
  vi.unstubAllGlobals();
});
function response(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
describe('public group voucher checkout', () => {
  it.each([' HEMAT ', '', '   '])('forwards optional code %j without client amounts', async (code) => {
    const fetchMock = response(422, { status: 'error', code: 'voucher_rejected' });
    const form = new FormData();
    Object.entries({ student_id: id, schedule_id: id, billing_cycle: 'monthly', payment_method: 'VA', idempotency_key: id, voucher_code: code, discount_amount: '999999', gross_amount: '1' }).forEach(([key, value]) => form.set(key, value));
    expect(await enrollInClass(id, { success: false, message: '' }, form)).toEqual(voucherRejectedState);
    expect(fetchMock).toHaveBeenCalledWith(`http://gateway.test/api/v1/catalog/classes/${id}/enrollments`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ student_id: id, billing_cycle: 'monthly', schedule_id: id, payment_method: 'VA', ...(code.trim() ? { voucher_code: 'HEMAT' } : {}) }), headers: expect.objectContaining({ 'Idempotency-Key': id }) }));
    expect(voucherRejectedState.message).toContain('checkout ulang tanpa voucher');
    expect(voucherRejectedState.message).toContain('invoice pengganti');
  });
  it('maps replacement invoice rejection on retry and sends a fresh checkout without voucher', async () => {
    const fetchMock = response(422, { status: 'error', code: 'voucher_rejected' });
    const form = new FormData();
    Object.entries({ student_id: id, schedule_id: id, billing_cycle: 'monthly', payment_method: 'VA', idempotency_key: id, voucher_code: 'HEMAT' }).forEach(([key, value]) => form.set(key, value));
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await enrollInClass(id, { success: false, message: '' }, form)).toEqual(voucherRejectedState);
    }
    const requests = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(requests[0][1]).toEqual(requests[1][1]);
    form.set('voucher_code', '');
    const freshKey = '4b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
    form.set('idempotency_key', freshKey);
    await enrollInClass(id, voucherRejectedState, form);
    expect(JSON.parse(requests[2][1].body as string)).toEqual({ student_id: id, billing_cycle: 'monthly', schedule_id: id, payment_method: 'VA' });
    expect(requests[2][1].headers).toMatchObject({ 'Idempotency-Key': freshKey });
  });
  it('previews using only code, under the parent session', async () => {
    const fetchMock = response(200, { status: 'success', data: { discount_amount: 10000, gross_amount: 90000 } });
    expect(await previewClassVoucher(id, ' HEMAT ')).toMatchObject({ success: true, data: { discount_amount: 10000, gross_amount: 90000 } });
    expect(fetchMock).toHaveBeenCalledWith(`http://gateway.test/api/v1/catalog/classes/${id}/voucher-preview`, expect.objectContaining({ method: 'POST', cache: 'no-store', body: '{"voucher_code":"HEMAT"}', headers: expect.objectContaining({ Authorization: `Bearer ${token}` }) }));
  });
  it('maps coded 422 preview rejection, not other statuses', async () => {
    response(422, { code: 'voucher_rejected' });
    expect(await previewClassVoucher(id, 'HEMAT')).toEqual(voucherRejectedState);
    response(500, { code: 'voucher_rejected' });
    expect(await previewClassVoucher(id, 'HEMAT')).not.toEqual(voucherRejectedState);
  });
  it('rejects empty input and non-parent sessions without fetching', async () => {
    const fetchMock = response(200, {});
    expect((await previewClassVoucher(id, ' ')).success).toBe(false);
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as never);
    expect((await previewClassVoucher(id, 'HEMAT')).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not display malformed preview amounts', async () => {
    response(200, { status: 'success', data: { discount_amount: '10000', gross_amount: -1 } });
    expect((await previewClassVoucher(id, 'HEMAT')).success).toBe(false);
  });
});
