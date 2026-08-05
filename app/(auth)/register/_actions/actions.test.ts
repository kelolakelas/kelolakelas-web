import { ApiError } from '@/lib/api/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequest, setCookie, deleteCookie } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  apiRequest,
  getAuthCookieName: () => 'auth_token',
  getTenantCookieName: () => 'tenant_id',
}));
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve({ set: setCookie, delete: deleteCookie }) }));

import { registerParent } from './actions';

function validFormData(): FormData {
  const formData = new FormData();
  formData.set('first_name', 'Ada');
  formData.set('last_name', 'Lovelace');
  formData.set('email', 'ada@example.com');
  formData.set('password', 'password123');
  return formData;
}

describe('registerParent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers with is_parent and logs in without returning the password', async () => {
    apiRequest
      .mockResolvedValueOnce({ status: 'success', data: { id: 'parent-1', email: 'ada@example.com', is_parent: true } })
      .mockResolvedValueOnce({ status: 'success', data: { token: 'jwt', user: { id: 'parent-1', is_parent: true } } });

    const result = await registerParent({ success: false, message: '' }, validFormData());

    expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/v1/auth/register', expect.objectContaining({ includeTenant: false, body: expect.stringContaining('"is_parent":true') }));
    expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/v1/auth/login', expect.objectContaining({ includeTenant: false }));
    expect(setCookie).toHaveBeenCalledWith('auth_token', 'jwt', expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }));
    expect(deleteCookie).toHaveBeenCalledWith('tenant_id');
    expect(result).toEqual({ success: true, message: 'Akun parent berhasil dibuat.', redirectTo: '/dashboard/parent' });
    expect(JSON.stringify(result)).not.toContain('password123');
  });

  it('does not call the API for invalid input', async () => {
    const result = await registerParent({ success: false, message: '' }, new FormData());
    expect(apiRequest).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('returns a safe duplicate email message', async () => {
    apiRequest.mockRejectedValueOnce(new ApiError('backend internals', 409));
    const result = await registerParent({ success: false, message: '' }, validFormData());
    expect(result).toEqual({ success: false, message: 'Email sudah terdaftar.' });
  });

  it('rejects an incomplete or non-parent registration response', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success', data: { id: 'user-1', email: 'user@example.com', is_parent: false } });
    const result = await registerParent({ success: false, message: '' }, validFormData());
    expect(result).toEqual({ success: false, message: 'Respons registrasi parent tidak valid.' });
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
});