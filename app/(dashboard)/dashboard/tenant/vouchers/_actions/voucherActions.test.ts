import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: 'synthetic-token' }) })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { createTenantVoucher, updateTenantVoucher } from './voucherActions';
import { voucherDateTimePayload } from '../_lib/datetime';
const id = '9b9ee145-f561-4acb-b231-6d22d076369c';
const initial = { success: false, message: '' };
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  Object.entries(fields).forEach(([k, v]) => f.set(k, v));
  return f;
};
beforeEach(() => vi.stubEnv('GATEWAY_API_URL', 'http://gateway.test'));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const respond = () => {
  const mock = vi.fn(
    async () =>
      new Response(JSON.stringify({ status: 'success', data: { id } }), {
        status: 200,
      }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
};
it('forwards browser-local full-day defaults without losing seconds in create payload', async () => {
  const request = respond();
  const from = voucherDateTimePayload('2026-12-31', '00:00:00'),
    until = voucherDateTimePayload('2026-12-31', '23:59:59');
  const result = await createTenantVoucher(
    initial,
    form({
      code: 'DAY',
      discount_type: 'percentage',
      discount_value: '10',
      valid_from: from,
      valid_until: until,
    }),
  );
  expect(result.success).toBe(true);
  const body = JSON.parse(
    (request.mock.calls as unknown as [string, RequestInit][])[0][1]
      .body as string,
  );
  expect(body).toMatchObject({ valid_from: from, valid_until: until });
  expect(new Date(body.valid_until).getSeconds()).toBe(59);
});
it('preserves stored offset time/seconds and milliseconds on update', async () => {
  const request = respond();
  const result = await updateTenantVoucher(
    initial,
    form({
      voucherId: id,
      valid_from: '2026-12-31T23:12:34.123+07:00',
      valid_until: '2027-01-01T00:23:59+07:00',
    }),
  );
  expect(result.success).toBe(true);
  expect(
    JSON.parse(
      (request.mock.calls as unknown as [string, RequestInit][])[0][1]
        .body as string,
    ),
  ).toMatchObject({
    valid_from: '2026-12-31T16:12:34.123Z',
    valid_until: '2026-12-31T17:23:59.000Z',
  });
});
it.each([
  ['2026-12-31T23:59:59Z', '2026-12-31T00:00:00Z'],
  ['2026-12-31T', '2027-01-01T00:00:00Z'],
])('rejects invalid range/date before network request', async (from, until) => {
  const request = respond();
  const result = await createTenantVoucher(
    initial,
    form({
      code: 'DAY',
      discount_type: 'percentage',
      discount_value: '10',
      valid_from: from,
      valid_until: until,
    }),
  );
  expect(result.success).toBe(false);
  expect(result.errors).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});
