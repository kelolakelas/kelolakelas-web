import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequest, setCookie, deleteCookie, redirect } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  apiRequest,
  getAuthCookieName: () => 'auth_token',
  getTenantCookieName: () => 'tenant_id',
}));
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve({ set: setCookie, delete: deleteCookie }) }));
vi.mock('next/navigation', () => ({ redirect }));

import { getSafeRedirect } from '@/lib/auth/redirect';
import { loginAction } from './actions';

function token(claims: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

function loginForm(redirectTo = ''): FormData {
  const formData = new FormData();
  formData.set('email', 'user@example.com');
  formData.set('password', 'password123');
  formData.set('redirectTo', redirectTo);
  return formData;
}

describe('loginAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('routes a parent to the parent dashboard and removes tenant context', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success', data: { token: token({ is_parent: true }), user: { id: 'parent-1', is_parent: true } } });
    await loginAction({ success: false, message: '' }, loginForm('/dashboard/tenant'));
    expect(deleteCookie).toHaveBeenCalledWith('tenant_id');
    expect(redirect).toHaveBeenCalledWith('/dashboard/parent');
  });

  it('routes a tenant to the tenant dashboard and preserves a safe redirect', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success', data: { token: token({ tenant_id: 'tenant-1' }), user: { id: 'user-1', tenant_id: 'tenant-1' } } });
    await loginAction({ success: false, message: '' }, loginForm('/dashboard/tenant/classes'));
    expect(setCookie).toHaveBeenCalledWith('tenant_id', 'tenant-1', expect.any(Object));
    expect(redirect).toHaveBeenCalledWith('/dashboard/tenant/classes');
  });

  it('rejects external and protocol-relative redirects', () => {
    expect(getSafeRedirect('https://example.com', '/dashboard/parent')).toBe('/dashboard/parent');
    expect(getSafeRedirect('//example.com', '/dashboard/parent')).toBe('/dashboard/parent');
    expect(getSafeRedirect('/classes/class-1', '/dashboard/parent')).toBe('/classes/class-1');
  });

  it('returns a parent to a safe class detail after login', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success', data: { token: token({ is_parent: true }), user: { id: 'parent-1', is_parent: true } } });
    await loginAction({ success: false, message: '' }, loginForm('/classes/class-1'));
    expect(redirect).toHaveBeenCalledWith('/classes/class-1');
  });

  it('rejects a login response without a token or user', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success', data: { token: 'jwt' } });
    const result = await loginAction({ success: false, message: '' }, loginForm());
    expect(result).toEqual({ success: false, message: 'Respons login tidak lengkap.' });
    expect(setCookie).not.toHaveBeenCalled();
  });
});