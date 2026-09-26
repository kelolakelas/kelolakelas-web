import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()), cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT'); }) }));

const { enrollInClass } = await import('./actions');
const { cookies } = await import('next/headers');

const id = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const token = `header.${Buffer.from(JSON.stringify({ user_id: id, is_parent: true })).toString('base64url')}.signature`;
const savedGateway = process.env.GATEWAY_API_URL;
const genericConflict = 'Jadwal penuh atau enrollment ini sudah berubah. Pilih jadwal lain atau gunakan checkout yang sama.';
const serverError = 'Checkout belum tersedia karena layanan pembayaran sedang bermasalah. Coba lagi nanti.';

function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ student_id: id, billing_cycle: 'monthly', schedule_id: '', idempotency_key: id })) data.set(key, value);
  return data;
}

function respondWith(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

beforeEach(() => {
  process.env.GATEWAY_API_URL = 'http://gateway.test';
  vi.mocked(cookies).mockReset().mockResolvedValue({ get: () => ({ value: token }) } as never);
});
afterEach(() => {
  if (savedGateway === undefined) delete process.env.GATEWAY_API_URL;
  else process.env.GATEWAY_API_URL = savedGateway;
  vi.unstubAllGlobals();
});

describe('enrollInClass conflict messages', () => {
  it('shows the duplicate enrollment message with a link to the enrollment status', async () => {
    respondWith(409, { status: 'error', code: 'duplicate_enrollment', message: 'student already has a pending or active enrollment in this class', data: null });
    const state = await enrollInClass(id, { success: false, message: '' }, form());
    expect(state).toEqual({
      success: false,
      message: 'Student ini sudah terdaftar atau masih memiliki pembayaran tertunda di kelas ini.',
      link: { href: '/dashboard/parent/enrollments', label: 'Lihat status enrollment' },
    });
  });

  it('keeps the previous message for a full schedule 409', async () => {
    respondWith(409, { status: 'error', message: 'selected schedule is full', data: null });
    const state = await enrollInClass(id, { success: false, message: '' }, form());
    expect(state).toEqual({ success: false, message: genericConflict });
  });

  it('keeps the previous message for an idempotency conflict 409', async () => {
    respondWith(409, { status: 'error', message: 'idempotency key was already used with a different enrollment request', data: null });
    const state = await enrollInClass(id, { success: false, message: '' }, form());
    expect(state).toEqual({ success: false, message: genericConflict });
  });

  it('ignores the duplicate code on a non-409 status', async () => {
    respondWith(500, { status: 'error', code: 'duplicate_enrollment', message: 'Failed to create enrollment' });
    const state = await enrollInClass(id, { success: false, message: '' }, form());
    expect(state).toEqual({ success: false, message: serverError });
  });

  it('keeps the server error message from an older backend that returned 500 for a duplicate', async () => {
    respondWith(500, { status: 'error', message: 'Failed to create enrollment', data: null });
    const state = await enrollInClass(id, { success: false, message: '' }, form());
    expect(state).toEqual({ success: false, message: serverError });
  });
});
