import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookieGet, fetchMock, revalidate } = vi.hoisted(() => ({ cookieGet: vi.fn(), fetchMock: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock('next/cache', () => ({ revalidatePath: revalidate }));
vi.mock('@/lib/gateway', () => ({ getGatewayBaseUrl: () => 'http://gateway' }));
import { requestCreator } from './actions';

const state = { status: 0, message: '' };
const token = (claims: object) => `header.${btoa(JSON.stringify(claims))}.signature`;
const form = () => { const f = new FormData(); f.set('target_email', 'new@example.com'); f.set('reason', 'Additional owner'); return f; };

describe('requestCreator authorization and validation', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); cookieGet.mockImplementation((name: string) => ({ value: name === 'tenant_id' ? 'tenant-a' : token({ tenant_id: 'tenant-a' }) })); });
  it('uses the tenant caller and tenant header, then refreshes status', async () => {
    fetchMock.mockResolvedValue({ status: 201 });
    expect((await requestCreator(state, form())).status).toBe(201);
    expect(fetchMock).toHaveBeenCalledWith('http://gateway/api/v1/creator-requests', expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${token({ tenant_id: 'tenant-a' })}`, 'X-Tenant-ID': 'tenant-a' }) }));
    expect(revalidate).toHaveBeenCalledWith('/dashboard/tenant/creator-requests');
  });
  it('never forwards a parent or platform session without tenant context', async () => {
    cookieGet.mockImplementation((name: string) => name === 'tenant_id' ? undefined : { value: 'platform-token' });
    expect((await requestCreator(state, form())).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects a platform token even if a stale tenant cookie remains', async () => {
    cookieGet.mockImplementation((name: string) => ({ value: name === 'tenant_id' ? 'tenant-a' : token({ is_platform_admin: true, platform_factor_version: 1 }) }));
    expect((await requestCreator(state, form())).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('propagates live Creator revocation and duplicate conflict', async () => {
    fetchMock.mockResolvedValueOnce({ status: 403 }).mockResolvedValueOnce({ status: 409 });
    expect((await requestCreator(state, form())).status).toBe(403);
    expect((await requestCreator(state, form())).status).toBe(409);
    expect(revalidate).not.toHaveBeenCalled();
  });
  it('rejects invalid input before dispatch', async () => {
    const invalid = form(); invalid.set('reason', ' ');
    expect((await requestCreator(state, invalid)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
