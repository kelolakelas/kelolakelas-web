import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmPasswordReset, requestPasswordReset } from './actions';

const deleteCookie = vi.fn();
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ delete: deleteCookie })) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));

const previous = { message: '' };
const request = (email: string) => {
  const data = new FormData();
  data.set('email', email);
  return data;
};
const confirm = (token = 'valid-token', password = 'longpassword', repeat = password) => {
  const data = new FormData();
  data.set('token', token);
  data.set('password', password);
  data.set('confirmPassword', repeat);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GATEWAY_API_URL = 'http://gateway.local';
});

describe('password reset Server Actions', () => {
  it.each(['registered@example.com', 'unknown@example.com'])('returns identical request confirmation for %s', async (email) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    await expect(requestPasswordReset(previous, request(email))).rejects.toThrow('REDIRECT:/forgot-password?sent=1');
    expect(fetch).toHaveBeenCalledWith('http://gateway.local/api/v1/auth/password-reset/request', expect.objectContaining({
      body: JSON.stringify({ email }), cache: 'no-store',
    }));
  });

  it('validates email before calling gateway', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await requestPasswordReset(previous, request('bad'))).errors?.email).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a generic Indonesian message for gateway 5xx, without confirming delivery', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, message: 'internal secret' })));
    const result = await requestPasswordReset(previous, request('test@example.com'));
    expect(result.message).toMatch(/Layanan sedang mengalami gangguan/);
    expect(result.message).not.toContain('internal secret');
  });

  it('posts only token and password, clears cookies, then redirects to login on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
    await expect(confirmPasswordReset(previous, confirm())).rejects.toThrow('REDIRECT:/login?reset=1');
    expect(fetch).toHaveBeenCalledWith('http://gateway.local/api/v1/auth/password-reset/confirm', expect.objectContaining({
      body: JSON.stringify({ token: 'valid-token', password: 'longpassword' }), cache: 'no-store',
    }));
    expect(deleteCookie).toHaveBeenCalledWith('auth_token');
    expect(deleteCookie).toHaveBeenCalledWith('tenant_id');
  });

  it.each([400, 503])('does not clear cookies when gateway returns %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status })));
    const result = await confirmPasswordReset(previous, confirm());
    expect(result.invalidToken).toBe(status === 400 ? true : undefined);
    expect(result.message).toMatch(status === 400 ? /tidak valid/ : /Layanan sedang mengalami gangguan/);
    expect(deleteCookie).not.toHaveBeenCalled();
  });

  it.each([confirm('', 'longpassword'), confirm('token', 'short'), confirm('token', 'longpassword', 'different')])('rejects malformed token/password without a gateway call', async (data) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await confirmPasswordReset(previous, data)).message).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(deleteCookie).not.toHaveBeenCalled();
  });
});
