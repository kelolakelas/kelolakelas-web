import { beforeEach, describe, expect, it, vi } from 'vitest';
const { cookieGet, fetchMock } = vi.hoisted(() => ({ cookieGet: vi.fn(), fetchMock: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock('@/lib/gateway', () => ({ getGatewayBaseUrl: () => 'http://gateway' }));
import { readCreatorRequests } from './creator-requests';
const token = (claims: object) => `header.${btoa(JSON.stringify(claims))}.signature`;
const tenantToken = token({ tenant_id: 'tenant-a' });
const platformToken = token({ is_platform_admin: true, platform_factor_version: 1 });

describe('Creator request reads', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); cookieGet.mockImplementation((name: string) => ({ value: name === 'tenant_id' ? 'tenant-a' : tenantToken })); });
  it('keeps platform and tenant endpoints and headers separate', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data: [] }) });
    cookieGet.mockImplementation((name: string) => name === 'tenant_id' ? undefined : { value: platformToken });
    expect((await readCreatorRequests(true)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith('http://gateway/api/v1/platform/creator-requests', expect.objectContaining({ headers: { Authorization: `Bearer ${platformToken}` } }));
    cookieGet.mockImplementation((name: string) => ({ value: name === 'tenant_id' ? 'tenant-a' : tenantToken }));
    await readCreatorRequests(false);
    expect(fetchMock).toHaveBeenCalledWith('http://gateway/api/v1/creator-requests', expect.objectContaining({ headers: { Authorization: `Bearer ${tenantToken}`, 'X-Tenant-ID': 'tenant-a' } }));
  });
  it('refuses mismatched caller scope before any request', async () => {
    cookieGet.mockImplementation((name: string) => ({ value: name === 'tenant_id' ? 'tenant-a' : platformToken }));
    expect((await readCreatorRequests(false)).status).toBe(403);
    cookieGet.mockImplementation((name: string) => ({ value: name === 'tenant_id' ? 'tenant-a' : tenantToken }));
    expect((await readCreatorRequests(true)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not render Creator controls on forbidden or unavailable responses', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 }).mockRejectedValueOnce(new Error('offline'));
    expect((await readCreatorRequests(false)).status).toBe(403);
    expect((await readCreatorRequests(false)).status).toBe(503);
  });
});
