import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { platformFeeRejectedState } from '@/lib/enrollment';

/**
 * Integration test for the tenant approve/reject Server Actions (KEL-110).
 *
 * The actions cannot reach their real collaborators here: `next/headers`
 * needs a request scope, `next/cache` needs a render scope, and the decisions
 * go out over `fetch`. All three are replaced, and what is asserted is the
 * observable contract the acceptance criteria depend on:
 *
 * - the exact method, path, headers, and body the gateway receives,
 *   including that the browser supplies only the request id (and the
 *   optional reason) while the tenant is derived from the session,
 * - that an invalid identifier never reaches the network,
 * - that 403 reads as a permission state and 409 as an already-changed row,
 * - that a successful approval returns the billing checkout link for the
 *   dialog to display with its copy button,
 * - that a successful decision revalidates the screen so the row is
 *   re-rendered from the backend rather than from an optimistic guess,
 * - that no message ever carries the raw server error text.
 */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'auth_token') return { name, value: 'session-token' };
      if (name === 'tenant_id') return { name, value: 'tenant-1' };
      return undefined;
    },
  })),
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }));

const { approveScheduleRequest, rejectScheduleRequest } = await import('./actions');
const { TENANT_SCHEDULE_REQUESTS_PATH } = await import('../_lib/schema');

const GATEWAY_URL = 'http://gateway.test';
const REQUEST_ID = '9a1c3e5f-2b4d-4e6f-8a0b-1c2d3e4f5a6b';
const APPROVE_PATH = `${GATEWAY_URL}/api/v1/schedule-requests/${REQUEST_ID}/approve`;
const REJECT_PATH = `${GATEWAY_URL}/api/v1/schedule-requests/${REQUEST_ID}/reject`;
const PAYMENT_URL = 'https://pay.test/checkout/session-1';

function approveSuccessBody() {
  return {
    status: 'success',
    data: {
      enrollment: { id: 'enrollment-1' },
      payment: {
        transaction_id: 'tx-1',
        checkout_session_url: PAYMENT_URL,
        gross_amount: 1500000,
        status: 'pending',
      },
    },
  };
}

function rejectSuccessBody() {
  return {
    status: 'success',
    data: { id: REQUEST_ID, status: 'rejected', rejection_reason: 'Slot penuh.' },
  };
}

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  );
}

function respondWithText(status: number, text: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(text, { status })));
}

function lastRequest(): { url: string; init: RequestInit } {
  const fetchMock = vi.mocked(fetch);
  const call = fetchMock.mock.calls.at(-1);
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

function approveForm(id = REQUEST_ID): FormData {
  const formData = new FormData();
  formData.set('request_id', id);
  return formData;
}

function rejectForm(id = REQUEST_ID, reason?: string): FormData {
  const formData = new FormData();
  formData.set('request_id', id);
  if (reason !== undefined) formData.set('reason', reason);
  return formData;
}

function rejectWithRecommendationForm(
  id = REQUEST_ID,
  reason: string | undefined,
  slots: unknown
): FormData {
  const formData = rejectForm(id, reason);
  formData.set('slots', typeof slots === 'string' ? slots : JSON.stringify(slots));
  return formData;
}

const savedGateway = process.env.GATEWAY_API_URL;

beforeEach(() => {
  process.env.GATEWAY_API_URL = GATEWAY_URL;
  revalidatePath.mockClear();
});

afterEach(() => {
  if (savedGateway === undefined) delete process.env.GATEWAY_API_URL;
  else process.env.GATEWAY_API_URL = savedGateway;
  vi.unstubAllGlobals();
});

describe('approveScheduleRequest', () => {
  it('posts the request id and returns the payment link for the dialog', async () => {
    respondWith(200, approveSuccessBody());

    const state = await approveScheduleRequest({ success: false, message: '' }, approveForm());

    expect(state.success).toBe(true);
    expect(state.message).toContain('disetujui');
    expect(state.paymentUrl).toBe(PAYMENT_URL);
    expect(state.grossAmount).toBe(1500000);

    const { url, init } = lastRequest();
    expect(url).toBe(APPROVE_PATH);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer session-token');
    expect((init.headers as Record<string, string>)['X-Tenant-ID']).toBe('tenant-1');
    // The browser supplies the identifier and nothing else: no tenant id, no
    // status, and no price can influence which request is approved.
    expect(init.body).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_SCHEDULE_REQUESTS_PATH);
  });

  it('confirms the approval when billing carries no usable link', async () => {
    respondWith(200, { status: 'success', data: { enrollment: { id: 'enrollment-1' } } });

    const state = await approveScheduleRequest({ success: false, message: '' }, approveForm());

    expect(state.success).toBe(true);
    expect(state.message).toContain('belum tersedia');
    expect(state.paymentUrl).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_SCHEDULE_REQUESTS_PATH);
  });

  it('never approves an invalid identifier over the network', async () => {
    respondWith(200, approveSuccessBody());

    const state = await approveScheduleRequest({ success: false, message: '' }, approveForm('not-a-uuid'));

    expect(state.success).toBe(false);
    expect(state.message).toContain('tidak valid');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps 403 to the enrollment:update permission message', async () => {
    respondWith(403, { status: 'error', message: 'forbidden: missing enrollment:update', code: 'forbidden', data: null });

    const state = await approveScheduleRequest({ success: false, message: '' }, approveForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('enrollment:update');
    expect(state.message).not.toContain('forbidden: missing enrollment:update');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps 409 to the already-changed message', async () => {
    respondWith(409, { status: 'error', message: 'request is no longer pending', code: 'conflict', data: null });

    const state = await approveScheduleRequest({ success: false, message: '' }, approveForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('statusnya sudah berubah');
    expect(state.message).not.toContain('no longer pending');
  });

  it('maps a non-JSON 409 to the already-changed message instead of throwing', async () => {
    // A proxy error page carries no envelope; the status still decides.
    respondWithText(409, '<html>Bad Gateway</html>');

    const state = await approveScheduleRequest({ success: false, message: '' }, approveForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('statusnya sudah berubah');
  });

  it('reuses the KEL-106 platform-fee wording for the matching 422 code', async () => {
    respondWith(422, {
      status: 'error',
      message: 'platform fee exceeds gross',
      code: 'platform_fee_exceeds_gross',
      data: null,
    });

    const state = await approveScheduleRequest({ success: false, message: '' }, approveForm());

    expect(state.success).toBe(false);
    expect(state.message).toBe(platformFeeRejectedState.message);
  });

  it('maps 404 and 5xx without leaking backend text', async () => {
    respondWith(404, { status: 'error', message: 'sql: no rows', data: null });
    const missing = await approveScheduleRequest({ success: false, message: '' }, approveForm());
    expect(missing.success).toBe(false);
    expect(missing.message).toContain('tidak ditemukan');
    expect(missing.message).not.toContain('sql: no rows');

    respondWith(500, { status: 'error', message: 'ERROR: deadlock', data: null });
    const failed = await approveScheduleRequest({ success: false, message: '' }, approveForm());
    expect(failed.success).toBe(false);
    expect(failed.message).toContain('tidak tersedia');
    expect(failed.message).not.toContain('deadlock');
  });
});

describe('rejectScheduleRequest', () => {
  it('rejects with a reason and sends it in the body', async () => {
    respondWith(200, rejectSuccessBody());

    const state = await rejectScheduleRequest({ success: false, message: '' }, rejectForm(REQUEST_ID, 'Slot penuh.'));

    expect(state.success).toBe(true);
    expect(state.message).toContain('ditolak');

    const { url, init } = lastRequest();
    expect(url).toBe(REJECT_PATH);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer session-token');
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'Slot penuh.' });
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_SCHEDULE_REQUESTS_PATH);
  });

  it('rejects without a reason by omitting the field from the body', async () => {
    respondWith(200, { status: 'success', data: { id: REQUEST_ID, status: 'rejected' } });

    const state = await rejectScheduleRequest({ success: false, message: '' }, rejectForm(REQUEST_ID, '   '));

    expect(state.success).toBe(true);
    const { init } = lastRequest();
    expect(JSON.parse(String(init.body))).toEqual({});
  });

  it('refuses a reason longer than 2000 characters without calling the backend', async () => {
    respondWith(200, rejectSuccessBody());

    const state = await rejectScheduleRequest(
      { success: false, message: '' },
      rejectForm(REQUEST_ID, 'x'.repeat(2001))
    );

    expect(state.success).toBe(false);
    expect(state.message).toContain('2000');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('never rejects an invalid identifier over the network', async () => {
    respondWith(200, rejectSuccessBody());

    const state = await rejectScheduleRequest({ success: false, message: '' }, rejectForm('not-a-uuid'));

    expect(state.success).toBe(false);
    expect(state.message).toContain('tidak valid');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('maps 403 to the enrollment:update permission message', async () => {
    respondWith(403, { status: 'error', message: 'forbidden', code: 'forbidden', data: null });

    const state = await rejectScheduleRequest({ success: false, message: '' }, rejectForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('enrollment:update');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps 409 to the already-changed message', async () => {
    respondWith(409, { status: 'error', message: 'request already decided by another member', data: null });

    const state = await rejectScheduleRequest({ success: false, message: '' }, rejectForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('statusnya sudah berubah');
    expect(state.message).not.toContain('already decided');
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;

    const state = await rejectScheduleRequest({ success: false, message: '' }, rejectForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('GATEWAY_API_URL');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('rejectScheduleRequest with a recommendation (KEL-116)', () => {
  it('rejects with recommended slots expanded to the backend HH:MM:SS format', async () => {
    respondWith(200, rejectSuccessBody());

    const state = await rejectScheduleRequest(
      { success: false, message: '' },
      rejectWithRecommendationForm(REQUEST_ID, 'Slot penuh.', [
        { day_of_week: 2, start_time: '10:00', end_time: '11:00' },
        { day_of_week: 4, start_time: '13:30', end_time: '14:30' },
      ])
    );

    expect(state.success).toBe(true);
    expect(state.message).toContain('rekomendasi');

    const { url, init } = lastRequest();
    expect(url).toBe(REJECT_PATH);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      reason: 'Slot penuh.',
      recommended_slots: [
        { day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00' },
        { day_of_week: 4, start_time: '13:30:00', end_time: '14:30:00' },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_SCHEDULE_REQUESTS_PATH);
  });

  it('rejects with a recommendation and no reason by omitting the reason field', async () => {
    respondWith(200, { status: 'success', data: { id: REQUEST_ID, status: 'rejected' } });

    const state = await rejectScheduleRequest(
      { success: false, message: '' },
      rejectWithRecommendationForm(REQUEST_ID, undefined, [
        { day_of_week: 2, start_time: '10:00', end_time: '11:00' },
      ])
    );

    expect(state.success).toBe(true);
    const { init } = lastRequest();
    expect(JSON.parse(String(init.body))).toEqual({
      recommended_slots: [{ day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00' }],
    });
  });

  it('keeps a plain rejection free of recommended slots', async () => {
    respondWith(200, rejectSuccessBody());

    const state = await rejectScheduleRequest({ success: false, message: '' }, rejectForm(REQUEST_ID, 'Slot penuh.'));

    expect(state.success).toBe(true);
    expect(state.message).toContain('ditolak');
    expect(state.message).not.toContain('rekomendasi');
    const { init } = lastRequest();
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'Slot penuh.' });
  });

  it('refuses an empty recommendation without calling the backend', async () => {
    respondWith(200, rejectSuccessBody());

    const state = await rejectScheduleRequest(
      { success: false, message: '' },
      rejectWithRecommendationForm(REQUEST_ID, 'Slot penuh.', [])
    );

    expect(state.success).toBe(false);
    expect(state.message).toContain('minimal satu slot rekomendasi');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ['an end time that is not after the start', [{ day_of_week: 2, start_time: '11:00', end_time: '10:00' }]],
    ['an equal start and end', [{ day_of_week: 2, start_time: '10:00', end_time: '10:00' }]],
    ['a day outside ISO 1-7', [{ day_of_week: 8, start_time: '10:00', end_time: '11:00' }]],
  ])('refuses %s without calling the backend', async (_label, slots) => {
    respondWith(200, rejectSuccessBody());

    const state = await rejectScheduleRequest(
      { success: false, message: '' },
      rejectWithRecommendationForm(REQUEST_ID, undefined, slots)
    );

    expect(state.success).toBe(false);
    expect(state.message).toContain('Slot rekomendasi tidak valid');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses an unparseable slots payload without calling the backend', async () => {
    respondWith(200, rejectSuccessBody());

    const state = await rejectScheduleRequest(
      { success: false, message: '' },
      rejectWithRecommendationForm(REQUEST_ID, undefined, 'bukan json')
    );

    expect(state.success).toBe(false);
    expect(state.message).toContain('Slot rekomendasi tidak valid');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('maps a 422 slot refusal from the backend without leaking backend text', async () => {
    respondWith(422, { status: 'error', message: 'slots must have valid times', data: null });

    const state = await rejectScheduleRequest(
      { success: false, message: '' },
      rejectWithRecommendationForm(REQUEST_ID, undefined, [
        { day_of_week: 2, start_time: '10:00', end_time: '11:00' },
      ])
    );

    expect(state.success).toBe(false);
    expect(state.message).toContain('tidak dapat diproses');
    expect(state.message).not.toContain('slots must have valid times');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps a 409 on a recommendation reject to the already-changed message', async () => {
    respondWith(409, { status: 'error', message: 'request is no longer pending', data: null });

    const state = await rejectScheduleRequest(
      { success: false, message: '' },
      rejectWithRecommendationForm(REQUEST_ID, undefined, [
        { day_of_week: 2, start_time: '10:00', end_time: '11:00' },
      ])
    );

    expect(state.success).toBe(false);
    expect(state.message).toContain('statusnya sudah berubah');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
