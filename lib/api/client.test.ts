import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';

const { getCookie, deleteCookie } = vi.hoisted(() => ({
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve({ get: getCookie, delete: deleteCookie }) }));

import { apiRequest } from './client';

function token(claims: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

function response(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

describe('apiRequest authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookie.mockImplementation((name: string) => name === 'auth_token'
      ? { value: token({ exp: Math.floor(Date.now() / 1000) + 3600 }) }
      : { value: 'tenant-1' });
  });

  it('sends Authorization and omits tenant context when requested', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(201, { status: 'success' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/v1/students', { method: 'POST', includeTenant: false, requiresAuth: true, body: '{}' });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get('Authorization')).toMatch(/^Bearer header\./);
    expect(new Headers(request.headers).has('X-Tenant-ID')).toBe(false);
  });

  it('preserves cookies for a missing authorization response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401, { status: 'error', message: 'Authorization header is required' })));

    await expect(apiRequest('/api/v1/students')).rejects.toMatchObject({ code: 'missing_authorization' });
    expect(deleteCookie).not.toHaveBeenCalled();
  });

  it('maps forbidden responses without deleting authentication cookies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(403, { status: 'error', message: 'forbidden' })));

    await expect(apiRequest('/api/v1/students')).rejects.toMatchObject({ code: 'permission_denied' });
    expect(deleteCookie).not.toHaveBeenCalled();
  });

  it('rejects expired or invalid tokens before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    getCookie.mockImplementation((name: string) => name === 'auth_token' ? { value: token({ exp: Math.floor(Date.now() / 1000) - 1 }) } : undefined);

    await expect(apiRequest('/api/v1/students', { requiresAuth: true })).rejects.toMatchObject({ code: 'token_expired' });
    expect(fetchMock).not.toHaveBeenCalled();

    getCookie.mockImplementation((name: string) => name === 'auth_token' ? { value: 'bad-token' } : undefined);
    await expect(apiRequest('/api/v1/students', { requiresAuth: true })).rejects.toMatchObject({ code: 'token_invalid' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retains the ApiError type for callers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(403, { status: 'error' })));
    await expect(apiRequest('/api/v1/students')).rejects.toBeInstanceOf(ApiError);
  });
});
