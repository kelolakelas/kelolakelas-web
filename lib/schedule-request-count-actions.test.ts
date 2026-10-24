import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: (name: string) => ({ value: name === 'tenant_id' ? 'tenant-a' : 'token' }) })) }));
vi.mock('./chat-unread-scope', () => ({ readChatUnreadScope: vi.fn(async () => 'a') }));
vi.mock('@/app/(dashboard)/dashboard/tenant/_queries/membership', () => ({ readTenantNav: vi.fn() }));
import { readTenantNav } from '@/app/(dashboard)/dashboard/tenant/_queries/membership';
import { readPendingScheduleRequestCount } from './schedule-request-count-actions';
const fetchMock = vi.fn();
function allow(permissions = ['enrollment:read']) {
  vi.mocked(readTenantNav).mockResolvedValue({ state: 'ok', items: [], roleName: 'Creator', membership: { member_id: 'm', role_id: 'r', role_name: 'Creator', permissions } });
}
const rows = (n: number) => Array.from({ length: n }, (_, id) => ({ id: String(id), status: 'pending', tenant_id: 'tenant-a' }));
function answer(data: unknown, status = 200) { fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: 'success', data }), { status })); }
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('GATEWAY_API_URL', 'http://gateway.test'); vi.stubGlobal('fetch', fetchMock); allow(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('pending navigation count', () => {
  it.each([0, 1, 99, 100, 140])('counts %i up to display cap with a dedicated pending filter', async n => {
    answer(rows(n));
    expect(await readPendingScheduleRequestCount('a')).toEqual({ count: Math.min(n, 100) });
    expect(fetchMock).toHaveBeenCalledWith('http://gateway.test/api/v1/schedule-requests?status=pending', expect.objectContaining({ cache: 'no-store', headers: expect.objectContaining({ Authorization: 'Bearer token', 'X-Tenant-ID': 'tenant-a' }) }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rejects stale scope and removed permission before reading requests', async () => {
    expect(await readPendingScheduleRequestCount('other')).toEqual({ count: null });
    allow([]);
    expect(await readPendingScheduleRequestCount('a')).toEqual({ count: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 403, 500])('does not reveal counts on HTTP %i', async status => {
    answer(rows(2), status);
    expect(await readPendingScheduleRequestCount('a')).toEqual({ count: null });
  });
  it.each(['approved', 'rejected', 'cancelled'])('rejects an unfiltered %s response', async status => {
    answer([{ ...rows(1)[0], status }]);
    expect(await readPendingScheduleRequestCount('a')).toEqual({ count: null });
  });
  it('rejects another tenant, duplicates, malformed responses and connection failure', async () => {
    for (const data of [[{ ...rows(1)[0], tenant_id: 'tenant-b' }], [rows(1)[0], rows(1)[0]], {}, null]) {
      answer(data); expect(await readPendingScheduleRequestCount('a')).toEqual({ count: null });
    }
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await readPendingScheduleRequestCount('a')).toEqual({ count: null });
  });
});
