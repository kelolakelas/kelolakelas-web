import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookieGet, fetchMock, revalidate } = vi.hoisted(() => ({ cookieGet: vi.fn(), fetchMock: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
vi.mock('@/lib/gateway', () => ({ getGatewayBaseUrl: () => 'http://gateway' }));
import { decideCreatorRequest } from './actions';

const state = { status: 0, message: '' };
const token = (claims: object) => `header.${btoa(JSON.stringify(claims))}.signature`;
const adminToken = token({ is_platform_admin: true, platform_factor_version: 1 });
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
// Identity emits the zero UUID string (not a missing claim) for tenantless
// verified platform sessions (see lib/creator-requests.ts).
const zeroUuidAdminToken = token({ is_platform_admin: true, platform_factor_version: 1, tenant_id: ZERO_UUID });
const id = '123e4567-e89b-42d3-a456-426614174000';
function form(decision: string, reason = '') { const f = new FormData(); f.set('id', id); f.set('decision', decision); f.set('reason', reason); return f; }

describe('platform Creator decisions', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); cookieGet.mockReturnValue({ value: adminToken }); });
  it('approves using only the platform session', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    expect((await decideCreatorRequest(state, form('approve'))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(`http://gateway/api/v1/platform/creator-requests/${id}/approve`, expect.objectContaining({ headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' } }));
    expect(revalidate).toHaveBeenCalledWith('/platform/creator-requests');
  });
  it('requires rejection reason and keeps failure states visible', async () => {
    expect((await decideCreatorRequest(state, form('reject'))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 }).mockResolvedValueOnce({ ok: false, status: 409 });
    expect((await decideCreatorRequest(state, form('reject', 'Not suitable'))).status).toBe(403);
    expect((await decideCreatorRequest(state, form('approve'))).status).toBe(409);
    expect(revalidate).not.toHaveBeenCalled();
  });
  it('approves with the zero-UUID tenantless platform scope', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    cookieGet.mockReturnValue({ value: zeroUuidAdminToken });
    expect((await decideCreatorRequest(state, form('approve'))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(`http://gateway/api/v1/platform/creator-requests/${id}/approve`, expect.objectContaining({ headers: { Authorization: `Bearer ${zeroUuidAdminToken}`, 'Content-Type': 'application/json' } }));
    expect(revalidate).toHaveBeenCalledWith('/platform/creator-requests');
  });
  it('a tenant or parent token cannot decide even by direct action invocation', async () => {
    for (const claims of [
      { tenant_id: 'tenant-a' },
      { is_parent: true },
      { is_platform_admin: true, platform_factor_version: 1, tenant_id: '11111111-1111-1111-1111-111111111111' },
      { is_platform_admin: true, platform_factor_version: 1, tenant_id: ZERO_UUID, is_parent: true },
      { is_platform_admin: true, platform_factor_version: 0, tenant_id: ZERO_UUID },
    ]) {
      cookieGet.mockReturnValue({ value: token(claims) });
      expect((await decideCreatorRequest(state, form('approve'))).status).toBe(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
  it('does not dispatch without a session', async () => {
    cookieGet.mockReturnValue(undefined);
    expect((await decideCreatorRequest(state, form('approve'))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
