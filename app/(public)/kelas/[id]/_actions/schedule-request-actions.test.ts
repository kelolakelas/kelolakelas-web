import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()), cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT'); }) }));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }));

const { createScheduleRequest, cancelScheduleRequest, acceptScheduleRecommendation, declineScheduleRecommendation } = await import('./actions');
const { cookies } = await import('next/headers');

const classId = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const studentId = '7c2e4d1b-5b8f-4d2e-8d3f-7a1c9e6b4f22';
const requestId = '9a1c3e5f-2b4d-4e6f-8a0b-1c2d3e4f5a6b';
const token = `header.${Buffer.from(JSON.stringify({ user_id: studentId, is_parent: true })).toString('base64url')}.signature`;
const savedGateway = process.env.GATEWAY_API_URL;

function createForm(overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set('class_id', classId);
  data.set('student_id', studentId);
  data.set('billing_cycle', 'monthly');
  data.set('slots', JSON.stringify([{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }]));
  data.set('note', 'Lokasi les di rumah.');
  for (const [key, value] of Object.entries(overrides)) data.set(key, value);
  return data;
}

function cancelForm(id = requestId) {
  const data = new FormData();
  data.set('request_id', id);
  return data;
}

function respondWith(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

function lastRequest(): { url: string; init: RequestInit } {
  const fetchMock = vi.mocked(fetch);
  const call = fetchMock.mock.calls.at(-1);
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

beforeEach(() => {
  process.env.GATEWAY_API_URL = 'http://gateway.test';
  vi.mocked(cookies).mockReset().mockResolvedValue({ get: () => ({ value: token }) } as never);
  revalidatePath.mockClear();
});
afterEach(() => {
  if (savedGateway === undefined) delete process.env.GATEWAY_API_URL;
  else process.env.GATEWAY_API_URL = savedGateway;
  vi.unstubAllGlobals();
});

describe('createScheduleRequest', () => {
  it('posts the request payload and confirms the pending review state', async () => {
    respondWith(201, { status: 'success', data: { id: requestId, status: 'pending' } });

    const state = await createScheduleRequest({ success: false, message: '' }, createForm());

    expect(state.success).toBe(true);
    expect(state.message).toContain('menunggu peninjauan');
    expect(state.link).toEqual({ href: `/kelas/${classId}#daftar-permintaan-jadwal`, label: 'Lihat daftar permintaan' });
    const { url, init } = lastRequest();
    expect(url).toBe(`http://gateway.test/api/v1/catalog/classes/${classId}/schedule-requests`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
    expect(JSON.parse(String(init.body))).toEqual({
      student_id: studentId,
      billing_cycle: 'monthly',
      slots: [{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }],
      note: 'Lokasi les di rumah.',
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/kelas/${classId}`);
  });

  it('reports a duplicate as the still-pending message with a link to the list', async () => {
    respondWith(409, { status: 'error', message: 'a pending request already exists', data: null });

    const state = await createScheduleRequest({ success: false, message: '' }, createForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('masih menunggu');
    expect(state.link).toEqual({ href: `/kelas/${classId}#daftar-permintaan-jadwal`, label: 'Lihat daftar permintaan' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an end time that is not after the start time before sending', async () => {
    respondWith(201, { status: 'success', data: {} });

    const state = await createScheduleRequest(
      { success: false, message: '' },
      createForm({ slots: JSON.stringify([{ day_of_week: 1, start_time: '18:00', end_time: '17:30' }]) })
    );

    expect(state.success).toBe(false);
    expect(state.message).toContain('Periksa kembali permintaan jadwal');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('rejects an empty slot list before sending', async () => {
    respondWith(201, { status: 'success', data: {} });

    const state = await createScheduleRequest(
      { success: false, message: '' },
      createForm({ slots: JSON.stringify([]) })
    );

    expect(state.success).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('maps validation refusals to the check-your-input message', async () => {
    respondWith(422, { status: 'error', message: 'slots are invalid', data: null });

    const state = await createScheduleRequest({ success: false, message: '' }, createForm());

    expect(state).toEqual({ success: false, message: 'Permintaan jadwal tidak dapat diproses. Periksa student, periode, dan slot Anda.' });
  });

  it('maps 401 to the parent login message', async () => {
    respondWith(401, { status: 'error', message: 'unauthorized', data: null });

    const state = await createScheduleRequest({ success: false, message: '' }, createForm());

    expect(state.message).toContain('parent yang login');
  });

  it('never surfaces the raw server error text', async () => {
    respondWith(500, { status: 'error', message: 'ERROR: deadlock detected (SQLSTATE 40P01)', data: null });

    const state = await createScheduleRequest({ success: false, message: '' }, createForm());

    expect(state.message).not.toContain('deadlock');
    expect(state.message).toContain('tidak tersedia');
  });

  it('refuses an invalid class id without calling the network', async () => {
    respondWith(201, { status: 'success', data: {} });

    const state = await createScheduleRequest({ success: false, message: '' }, createForm({ class_id: 'not-a-uuid' }));

    expect(state.message).toContain('Kelas tidak valid');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe('cancelScheduleRequest', () => {
  it('posts to the cancel route with the session bearer token and revalidates', async () => {
    respondWith(200, { status: 'success', data: { id: requestId, class_id: classId, status: 'cancelled' } });

    const state = await cancelScheduleRequest({ success: false, message: '' }, cancelForm());

    expect(state).toEqual({ success: true, message: 'Permintaan jadwal berhasil dibatalkan.' });
    const { url, init } = lastRequest();
    expect(url).toBe(`http://gateway.test/api/v1/schedule-requests/${requestId}/cancel`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
    expect(init.body).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith(`/kelas/${classId}`);
  });

  it('never reaches the network for an identifier that is not a UUID', async () => {
    respondWith(200, { status: 'success', data: {} });

    const state = await cancelScheduleRequest({ success: false, message: '' }, cancelForm('not-a-uuid'));

    expect(state.message).toContain('ID permintaan jadwal tidak valid');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reports another parent\u2019s request as not found', async () => {
    respondWith(404, { status: 'error', message: 'Schedule request not found', data: null });

    const state = await cancelScheduleRequest({ success: false, message: '' }, cancelForm());

    expect(state.message).toContain('tidak ditemukan');
  });

  it('explains a 409 refusal as a status that already changed', async () => {
    respondWith(409, { status: 'error', message: 'only pending requests can be cancelled', data: null });

    const state = await cancelScheduleRequest({ success: false, message: '' }, cancelForm());

    expect(state.message).toContain('statusnya sudah berubah');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('acceptScheduleRecommendation (KEL-116)', () => {
  it('posts to the recommendation accept route and redirects to the checkout link', async () => {
    respondWith(200, {
      status: 'success',
      data: {
        enrollment: { id: 'enrollment-1', status: 'pending_payment' },
        payment: { transaction_id: 'txn-1', checkout_session_url: 'https://pay.test/checkout/1', gross_amount: 150000, status: 'pending' },
      },
    });

    let redirectTarget: string | null = null;
    const { redirect } = await import('next/navigation');
    vi.mocked(redirect).mockImplementationOnce(((url: string) => {
      redirectTarget = url;
      throw new Error('REDIRECT');
    }) as never);

    await expect(
      acceptScheduleRecommendation({ success: false, message: '' }, cancelForm())
    ).rejects.toThrow('REDIRECT');

    const { url, init } = lastRequest();
    expect(url).toBe(`http://gateway.test/api/v1/schedule-requests/${requestId}/recommendation/accept`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
    expect(init.body).toBeUndefined();
    expect(redirectTarget).toBe('https://pay.test/checkout/1');
    expect(revalidatePath).toHaveBeenCalled();
  });

  it('reports a missing checkout link instead of redirecting anywhere', async () => {
    respondWith(200, {
      status: 'success',
      data: { enrollment: { id: 'enrollment-1' }, payment: { checkout_session_url: 'notaurl', gross_amount: 0 } },
    });

    const state = await acceptScheduleRecommendation({ success: false, message: '' }, cancelForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('URL checkout');
    expect(revalidatePath).toHaveBeenCalled();
  });

  it('never accepts an identifier that is not a UUID over the network', async () => {
    respondWith(200, { status: 'success', data: {} });

    const state = await acceptScheduleRecommendation({ success: false, message: '' }, cancelForm('not-a-uuid'));

    expect(state.message).toContain('ID permintaan jadwal tidak valid');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('explains a 409 on accept as a recommendation that already changed', async () => {
    respondWith(409, { status: 'error', message: 'recommendation was already declined', data: null });

    const state = await acceptScheduleRecommendation({ success: false, message: '' }, cancelForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('statusnya sudah berubah');
    expect(state.message).not.toContain('already declined');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps 401/403 to the owning-parent login message', async () => {
    respondWith(403, { status: 'error', message: 'forbidden', data: null });

    const state = await acceptScheduleRecommendation({ success: false, message: '' }, cancelForm());

    expect(state.message).toContain('parent');
    expect(state.message).not.toContain('forbidden');
  });

  it('never surfaces the raw server error text on accept', async () => {
    respondWith(500, { status: 'error', message: 'ERROR: deadlock detected (SQLSTATE 40P01)', data: null });

    const state = await acceptScheduleRecommendation({ success: false, message: '' }, cancelForm());

    expect(state.message).not.toContain('deadlock');
    expect(state.message).toContain('tidak tersedia');
  });
});

describe('declineScheduleRecommendation (KEL-116)', () => {
  it('posts to the recommendation decline route and confirms the declined state', async () => {
    respondWith(200, { status: 'success', data: { id: requestId, class_id: classId, status: 'declined' } });

    const state = await declineScheduleRecommendation({ success: false, message: '' }, cancelForm());

    expect(state).toEqual({ success: true, message: 'Rekomendasi jadwal berhasil ditolak.' });
    const { url, init } = lastRequest();
    expect(url).toBe(`http://gateway.test/api/v1/schedule-requests/${requestId}/recommendation/decline`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${token}`);
    expect(init.body).toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith(`/kelas/${classId}`);
  });

  it('never declines an identifier that is not a UUID over the network', async () => {
    respondWith(200, { status: 'success', data: {} });

    const state = await declineScheduleRecommendation({ success: false, message: '' }, cancelForm('not-a-uuid'));

    expect(state.message).toContain('ID permintaan jadwal tidak valid');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reports another parent\u2019s recommendation as not found', async () => {
    respondWith(404, { status: 'error', message: 'Schedule request not found', data: null });

    const state = await declineScheduleRecommendation({ success: false, message: '' }, cancelForm());

    expect(state.message).toContain('tidak ditemukan');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('explains a 409 on decline as a recommendation that already changed', async () => {
    respondWith(409, { status: 'error', message: 'recommendation was already accepted', data: null });

    const state = await declineScheduleRecommendation({ success: false, message: '' }, cancelForm());

    expect(state.message).toContain('statusnya sudah berubah');
    expect(state.message).not.toContain('already accepted');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('never surfaces the raw server error text on decline', async () => {
    respondWith(500, { status: 'error', message: 'ERROR: deadlock detected (SQLSTATE 40P01)', data: null });

    const state = await declineScheduleRecommendation({ success: false, message: '' }, cancelForm());

    expect(state.message).not.toContain('deadlock');
    expect(state.message).toContain('tidak tersedia');
  });
});
