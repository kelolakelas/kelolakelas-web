import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const cookieScope = vi.hoisted(() => ({ tenant: '' }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === 'auth_token' ? { value: 'session-token' } : name === 'tenant_id' && cookieScope.tenant ? { value: cookieScope.tenant } : undefined,
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
  cookieScope.tenant = "";
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
const tenant = '5d99c627-06ca-4613-95f8-4e29c32a7a42';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const savedClass = { id, tenant_id: tenant, category_id: teacher, name: 'Saved', type: 'group', price: 100, created_at: '2026-10-01T00:00:00Z', is_published: false, enrollment_status: 'open' };
const savedSlot = (n: number) => ({ id: uuid(n), class_id: id, day_of_week: 1, start_time: '09:00:00', end_time: '10:00:00', capacity: 5 });
const savedCategory = (n: number) => ({ id: uuid(n+1000), tenant_id: tenant, name: `Category ${n}`, created_at: '2026-10-01T00:00:00Z' });
const page = <T,>(items: T[], index: number, total: number) => ({ items, pagination: { page: index, page_size: 100, total_items: total, total_pages: Math.ceil(total / 100) } });
function savedReads(slots = 105, categories = 205) {
  return async (url: string) => {
    const path = new URL(url).pathname;
    const index = Number(new URL(url).searchParams.get('page') || '1');
    if (path === `/api/v1/classes/${id}`) return response(savedClass);
    const total = path === `/api/v1/classes/${id}/schedules` ? slots : categories;
    if (path !== `/api/v1/classes/${id}/schedules` && path !== '/api/v1/categories') throw new Error('Unexpected exhaustive read');
    const start = (index - 1) * 100;
    const items = Array.from({length: Math.max(0,Math.min(100,total-start))}, (_, i) => path.endsWith('/schedules') ? savedSlot(start+i+1) : savedCategory(start+i+1));
    return response(page(items,index,total));
  };
}
it('reads only the selected unpublished class and every scoped schedule/category page', async () => {
  fetchMock.mockImplementation(savedReads());
  const result = await readClassConfiguration(id);
  expect(result.success).toBe(true);
  expect(result.data?.class).toMatchObject({ id, is_published: false });
  expect(result.data?.schedules).toHaveLength(105);
  expect(result.data?.categories).toHaveLength(205);
  expect(result.data?.schedules.at(-1)?.id).toBe(uuid(105));
  expect(fetchMock).toHaveBeenCalledTimes(6);
  for (const [url, options] of fetchMock.mock.calls) {
    expect(new URL(url).pathname).not.toMatch(/^\/api\/v1\/(classes|schedules)$/);
    expect(options.cache).toBe('no-store');
    expect(options.headers.Authorization).toBe('Bearer session-token');
  }
});
it.each([401,403,404,503])('does not turn a refused scoped read (%s) into empty success', async status => {
  fetchMock.mockResolvedValue(response(null,status));
  expect(await readClassConfiguration(id)).toMatchObject({ success:false });
});
it.each(['missing pagination','wrong page','later failure','duplicate schedules','wrong class','wrong schedule scope'])('rejects incomplete or mismatched saved state: %s',async scenario=>{
  const good=savedReads(105,1);
  fetchMock.mockImplementation(async(url:string)=>{
    const path=new URL(url).pathname, index=Number(new URL(url).searchParams.get('page')||'1');
    if(scenario==='wrong class'&&path===`/api/v1/classes/${id}`)return response({...savedClass,id:teacher});
    if(path.endsWith('/schedules')) {
      if(scenario==='missing pagination')return response({items:[]});
      if(scenario==='wrong page')return response(page([savedSlot(1)],2,1));
      if(scenario==='later failure'&&index===2)return response(null,503);
      if(scenario==='duplicate schedules'&&index===2)return response(page(Array.from({length:5},(_,i)=>savedSlot(i+1)),2,105));
      if(scenario==='wrong schedule scope')return response(page([{...savedSlot(1),class_id:teacher}],1,1));
    }
    return good(url);
  });
  const result=await readClassConfiguration(id);
  expect(result.success).toBe(false);expect(result.data).toBeUndefined();
});
it('fetches authoritative data again after a save instead of caching a prior editor snapshot',async()=>{
  let revision=1;const good=savedReads(1,1);
  fetchMock.mockImplementation((url:string)=>new URL(url).pathname===`/api/v1/classes/${id}`?Promise.resolve(response({...savedClass,name:`Revision ${revision}`})):good(url));
  expect((await readClassConfiguration(id)).data?.class.name).toBe('Revision 1');
  revision=2;
  expect((await readClassConfiguration(id)).data?.class.name).toBe('Revision 2');
  expect(fetchMock).toHaveBeenCalledTimes(6);
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

it('rejects a saved class or category outside the active cookie tenant',async()=>{
 cookieScope.tenant=tenant;
 const good=savedReads(1,1);
 fetchMock.mockImplementation((url:string)=>new URL(url).pathname===`/api/v1/classes/${id}`?Promise.resolve(response({...savedClass,tenant_id:teacher})):good(url));
 expect((await readClassConfiguration(id)).success).toBe(false);
 fetchMock.mockImplementation((url:string)=>new URL(url).pathname==='/api/v1/categories'?Promise.resolve(response(page([{...savedCategory(1),tenant_id:teacher}],1,1))):good(url));
 expect((await readClassConfiguration(id)).success).toBe(false);
});
