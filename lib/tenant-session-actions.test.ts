import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('./chat-unread-scope', () => ({ readChatUnreadScope: vi.fn() }));
import { cookies } from 'next/headers';
import { readChatUnreadScope } from './chat-unread-scope';
import { revalidatePath } from 'next/cache';
import { readTenantChoices, switchTenant } from './tenant-session-actions';
const choice = { tenant_id: '00000000-0000-0000-0000-000000000002', member_id: '00000000-0000-0000-0000-000000000003', role_id: '00000000-0000-0000-0000-000000000004', tenant_name: 'Tenant B', role_name: 'Teacher' };
const set = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  process.env.GATEWAY_API_URL = 'http://gateway.test';
  vi.mocked(cookies).mockResolvedValue({ get: (name: string) => ({ value: name === 'auth_token' ? 'old-token' : 'tenant-a' }), set } as unknown as Awaited<ReturnType<typeof cookies>>);
  vi.mocked(readChatUnreadScope).mockResolvedValue('old-scope');
  vi.stubGlobal('fetch', vi.fn());
});
describe('tenant session actions', () => {
  it('rejects a stale tab before making a request or changing cookies', async () => {
    expect((await switchTenant('stale-scope', choice.tenant_id)).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled();
  });
  it.each([401, 403, 503])('preserves the old session for upstream %d', async status => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: 'error' }), { status }));
    expect((await switchTenant('old-scope', choice.tenant_id)).ok).toBe(false);
    expect(set).not.toHaveBeenCalled(); expect(revalidatePath).not.toHaveBeenCalled();
  });
  it('writes both HttpOnly cookies only for a matching authoritative membership and invalidates layout', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: 'success', data: { token: 'new-token', membership: choice } })));
    vi.mocked(readChatUnreadScope).mockResolvedValueOnce('old-scope').mockResolvedValueOnce('new-scope');
    expect(await switchTenant('old-scope', choice.tenant_id)).toEqual({ ok: true, scope: 'new-scope' });
    expect(set).toHaveBeenCalledWith('auth_token', 'new-token', expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }));
    expect(set).toHaveBeenCalledWith('tenant_id', choice.tenant_id, expect.anything());
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    const request = vi.mocked(fetch).mock.calls[0][1];
    expect(JSON.parse(request!.body as string)).toEqual({ tenant_id: choice.tenant_id });
    expect(JSON.stringify(request)).not.toContain('role_id');
  });
  it('refuses mismatching or malformed success without replacing cookies', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: 'success', data: { token: 'token', membership: { ...choice, tenant_id: choice.member_id } } })));
    expect((await switchTenant('old-scope', choice.tenant_id)).ok).toBe(false); expect(set).not.toHaveBeenCalled();
  });
  it('distinguishes a complete empty list from a failed membership read', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', data: [] })));
    expect(await readTenantChoices()).toEqual({ choices: [], activeTenant: 'tenant-a', error: false });
    vi.mocked(fetch).mockRejectedValueOnce(new Error('unavailable'));
    expect((await readTenantChoices()).error).toBe(true);
  });
});
