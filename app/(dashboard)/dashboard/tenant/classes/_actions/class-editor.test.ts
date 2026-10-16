import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === 'auth_token' ? { value: 'session-token' } : undefined,
  })),
}));
const revalidate = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
import {
  changeClassSchedule,
  deleteClassSchedule,
  readClassConfiguration,
  updateClass,
} from './classActions';
const id = '9b9ee145-f561-4acb-b231-6d22d076369c',
  teacher = 'f231dcfe-a8d2-4b2a-b682-43fe0fbb7022';
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GATEWAY_API_URL', 'http://gateway.test');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const response = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      status: status < 400 ? 'success' : 'error',
      data,
      message: 'Refused',
    }),
    { status },
  );
it('updates inline category, publication/status and teachers in one class PATCH', async () => {
  fetchMock.mockResolvedValue(response({ id }));
  const form = new FormData();
  for (const [key, value] of Object.entries({
    class_id: id,
    name: 'Revised',
    price: '175000',
    description: 'Summary',
    new_category: 'true',
    category_name: 'New',
    category_description: 'Detail',
    is_published: 'false',
    enrollment_status: 'closed',
    teacher_ids: JSON.stringify([teacher]),
  }))
    form.set(key, value);
  expect(
    (await updateClass({ success: false, message: '' }, form)).success,
  ).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    name: 'Revised',
    price: 175000,
    description: 'Summary',
    category: { name: 'New', description: 'Detail' },
    is_published: false,
    enrollment_status: 'closed',
    teacher_ids: [teacher],
  });
});
it('forwards all editable slot fields with explicit effective date and tenant authentication', async () => {
  fetchMock.mockResolvedValue(response({}));
  const slot = {
    day_of_week: 3,
    start_time: '09:00',
    end_time: '10:00',
    capacity: 4,
    location: 'Room B',
    tutor_id: teacher,
  };
  expect((await changeClassSchedule(id, slot, '2026-12-01')).success).toBe(
    true,
  );
  expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/schedules/permanent');
  expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    old_schedule_id: id,
    new_day_of_week: 3,
    new_start_time: '09:00',
    new_end_time: '10:00',
    new_capacity: 4,
    new_location: 'Room B',
    new_tutor_id: teacher,
    effective_date: '2026-12-01T00:00:00Z',
  });
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
    'Bearer session-token',
  );
});
it.each([400, 403, 409, 503])(
  'keeps rejected schedule mutation %s as failure with no success revalidation',
  async (status) => {
    fetchMock.mockResolvedValue(response(null, status));
    expect((await deleteClassSchedule(id)).success).toBe(false);
    expect(revalidate).not.toHaveBeenCalled();
  },
);
it('loads every list page and scopes saved schedules to the requested class', async () => {
  fetchMock.mockImplementation(async (url: string) => {
    const path = new URL(url).pathname;
    const page = new URL(url).searchParams.get('page');
    if (path.endsWith('classes'))
      return response({
        items: [{ id }],
        pagination: { page: 1, total_pages: 1 },
      });
    if (path.endsWith('categories'))
      return response({ items: [], pagination: { page: 1, total_pages: 1 } });
    return response({
      items: [{ id: `slot-${page}`, class_id: page === '2' ? id : 'other' }],
      pagination: { page: Number(page), total_pages: 2 },
    });
  });
  const result = await readClassConfiguration(id);
  expect(result.success).toBe(true);
  expect(result.data?.schedules).toEqual([{ id: 'slot-2', class_id: id }]);
  expect(fetchMock).toHaveBeenCalledTimes(4);
});
it('does not report unavailable list reads as an empty saved configuration', async () => {
  fetchMock.mockResolvedValue(response(null, 403));
  expect((await readClassConfiguration(id)).success).toBe(false);
});
it('rejects invalid capacity/date/identifier without calling the network', async () => {
  expect(
    (
      await changeClassSchedule(
        id,
        { day_of_week: 1, start_time: '09:00', end_time: '10:00', capacity: 0 },
        'bad',
      )
    ).success,
  ).toBe(false);
  expect((await deleteClassSchedule('bad')).success).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
