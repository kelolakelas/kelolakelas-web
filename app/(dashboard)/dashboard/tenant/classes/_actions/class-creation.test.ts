import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (key: string) =>
      key === 'auth_token' ? { value: 'test-token' } : undefined,
  })),
}));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
import { createClassConfiguration } from './classActions';
import type { ClassCreationInput } from '../_lib/class-creation';
const teacher = 'f231dcfe-a8d2-4b2a-b682-43fe0fbb7022';
const payload: ClassCreationInput = {
  category: { name: 'Math' },
  class: { name: 'Atomic', type: 'group', price: 150000 },
  teacher_ids: [teacher],
  schedules: [
    {
      day_of_week: 1,
      start_time: '09:00',
      end_time: '10:00',
      capacity: 10,
      tutor_id: teacher,
    },
  ],
};
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GATEWAY_API_URL', 'http://gateway.test');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('makes one authenticated aggregate POST and refreshes only after complete success', async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        status: 'success',
        data: {
          class: { id: 'saved', name: 'Atomic' },
          schedules: [{ id: 'slot' }],
          sessions: [{ id: 'session' }],
        },
      }),
      { status: 201 },
    ),
  );
  const result = await createClassConfiguration(payload, 'retry-123');
  expect(result.success).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe('http://gateway.test/api/v1/classes/with-category');
  expect(options.headers).toMatchObject({
    Authorization: 'Bearer test-token',
    'Idempotency-Key': 'retry-123',
  });
  expect(JSON.parse(options.body)).toMatchObject({
    ...payload,
    schedules: [
      { ...payload.schedules[0], start_time: '09:00:00', end_time: '10:00:00' },
    ],
  });
  expect(revalidate).toHaveBeenCalledWith('/dashboard/tenant/classes');
});
it.each([400, 401, 403])(
  'rejects status %s without refresh and allows correcting the draft',
  async (status) => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'error', message: 'Invalid value' }),
        { status },
      ),
    );
    const result = await createClassConfiguration(payload, 'retry-123');
    expect(result.success).toBe(false);
    expect(result.retrySameRequest).toBe(false);
    expect(revalidate).not.toHaveBeenCalled();
  },
);
it.each([409, 500, 502, 503])(
  'preserves original request after status %s',
  async (status) => {
    fetchMock.mockResolvedValue(new Response('{}', { status }));
    const result = await createClassConfiguration(payload, 'retry-123');
    expect(result).toMatchObject({ success: false, retrySameRequest: true });
    expect(revalidate).not.toHaveBeenCalled();
  },
);
it('treats a lost or malformed success response as unknown rather than declaring failure with no writes', async () => {
  fetchMock
    .mockRejectedValueOnce(new Error('lost response'))
    .mockResolvedValueOnce(new Response('not JSON', { status: 201 }));
  expect(await createClassConfiguration(payload, 'retry-123')).toMatchObject({
    success: false,
    retrySameRequest: true,
  });
  expect(await createClassConfiguration(payload, 'retry-123')).toMatchObject({
    success: false,
    retrySameRequest: true,
  });
  expect(fetchMock.mock.calls[0][1].body).toEqual(
    fetchMock.mock.calls[1][1].body,
  );
});
it('validates categories, assignment and private slots before any network write', async () => {
  for (const invalid of [
    { ...payload, category_id: 'bad' },
    { ...payload, teacher_ids: [] },
    { ...payload, class: { ...payload.class, type: 'private' as const } },
    { ...payload, schedules: [{ ...payload.schedules[0], capacity: 0 }] },
  ])
    expect((await createClassConfiguration(invalid, 'retry-123')).success).toBe(
      false,
    );
  expect(fetchMock).not.toHaveBeenCalled();
});
