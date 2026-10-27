import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptExistingInvitation, signInForInvitation } from './actions';
import { getLoginDestination } from '@/lib/auth-routing';

const mocks = vi.hoisted(() => ({ token: 'access', fetch: vi.fn(), delete: vi.fn(), redirect: vi.fn(), revalidate: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => mocks.token ? { value: mocks.token } : undefined, delete: mocks.delete }) }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/gateway', () => ({ getGatewayBaseUrl: () => 'http://gateway.test', withGatewayClientIp: async (headers: unknown) => headers }));

function form() { const data = new FormData(); data.set('token', 'invitation-token'); data.set('tenant_id', 'forged'); data.set('user_id', 'forged'); return data; }
beforeEach(() => { vi.clearAllMocks(); mocks.token = 'access'; vi.stubGlobal('fetch', mocks.fetch); });
describe('authenticated invitation acceptance', () => {
  it('sends only the token and cookie authorization; keeps the active tenant session', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ status: 'success', data: { member_id: 'member' } })));
    expect((await acceptExistingInvitation({ success: false, message: '' }, form())).success).toBe(true);
    const [url, request] = mocks.fetch.mock.calls[0];
    expect(url).toBe('http://gateway.test/api/v1/invitations/accept');
    expect(JSON.parse(request.body)).toEqual({ token: 'invitation-token' });
    expect(request.headers.Authorization).toBe('Bearer access');
    expect(request.cache).toBe('no-store'); expect(mocks.delete).not.toHaveBeenCalled();
  });
  it('retains the return-to-invitation path when the session is absent', async () => {
    mocks.token = '';
    const result = await acceptExistingInvitation({ success: false, message: '' }, form());
    expect(result.success).toBe(false); expect(result.redirectTo).toContain(encodeURIComponent('/invitations/verify?token=invitation-token'));
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([401, 403, 409, 400, 404, 503])('handles refusal/outage %i without success or losing the invitation', async status => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ status: 'error', message: 'secret upstream detail' }), { status }));
    const result = await acceptExistingInvitation({ success: false, message: '' }, form());
    expect(result.success).toBe(false); expect(result.message).not.toContain('secret upstream detail');
  });
  it('rejects malformed payloads and network failures without claiming acceptance', async () => {
    mocks.fetch.mockResolvedValue(new Response('{broken'));
    expect((await acceptExistingInvitation({ success: false, message: '' }, form())).success).toBe(false);
    mocks.fetch.mockRejectedValue(new Error('offline'));
    expect((await acceptExistingInvitation({ success: false, message: '' }, form())).success).toBe(false);
  });
  it('clears both browser session cookies/cache before returning to invitation login', async () => {
    await signInForInvitation(form());
    expect(mocks.delete).toHaveBeenCalledWith('auth_token'); expect(mocks.delete).toHaveBeenCalledWith('tenant_id');
    expect(mocks.revalidate).toHaveBeenCalledWith('/', 'layout');
    expect(mocks.redirect).toHaveBeenCalledWith('/login?redirectTo=%2Finvitations%2Fverify%3Ftoken%3Dinvitation-token');
  });
  it('allows the exact invitation path after login while rejecting external/other paths', () => {
    const identity = { is_parent: false, tenant_id: 'tenant' };
    expect(getLoginDestination(identity, '/invitations/verify?token=a%26b&redirectTo=https://evil.test')).toBe('/invitations/verify?token=a%26b');
    for (const path of ['//evil.test', 'https://evil.test', '/invitations/verify/other?token=x', '/invitations/verify?redirectTo=x']) expect(getLoginDestination(identity, path)).toBe('/dashboard/tenant');
  });
});
