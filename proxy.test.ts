import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeToken(payload: object) {
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function makeRequest(path: string, token?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: token ? { cookie: `auth_token=${token}` } : undefined,
  });
}

describe('authentication proxy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends unauthenticated protected requests to login', () => {
    const response = proxy(makeRequest('/dashboard/tenant'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/login?redirectTo=%2Fdashboard%2Ftenant'
    );
  });

  describe('tenant dashboard guard', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const paths = ['/dashboard/tenant', '/dashboard/tenant/members', '/dashboard/tenant/members?sort=name'];

    it.each(paths)('redirects parent sessions from %s to the catalog', (path) => {
      const response = proxy(makeRequest(path, makeToken({
        exp: Math.floor(Date.now() / 1000) + 3600,
        is_parent: true,
        tenant_id: tenantId,
      })));

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost/kelas');
    });

    it.each([undefined, '', '   ', '00000000-0000-0000-0000-000000000000', null, 123])(
      'redirects a session with unusable tenant context %s to the public home', (tenant_id) => {
        const response = proxy(makeRequest('/dashboard/tenant/members', makeToken({
          exp: Math.floor(Date.now() / 1000) + 3600,
          is_parent: false,
          tenant_id,
        })));

        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('http://localhost/');
      }
    );

    it.each(paths)('serves %s to a tenant owner session', (path) => {
      const response = proxy(makeRequest(path, makeToken({
        exp: Math.floor(Date.now() / 1000) + 3600,
        is_parent: false,
        tenant_id: tenantId,
      })));

      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });

    it.each([undefined, 'malformed', makeToken({ is_parent: true }), makeToken({ exp: 0, is_parent: true })])(
      'sends missing or invalid sessions to login before applying the tenant guard', (token) => {
        const path = '/dashboard/tenant/members?sort=name';
        const response = proxy(makeRequest(path, token));

        expect(response.status).toBe(307);
        const location = new URL(response.headers.get('location') || '');
        expect(location.pathname).toBe('/login');
        expect(location.searchParams.get('redirectTo')).toBe(path);
        if (token) expect(response.headers.get('set-cookie')).toContain('auth_token=;');
      }
    );

    it.each(['/dashboard/tenants', '/platform/login', '/platform'])('does not broaden the tenant guard to %s', (path) => {
      expect(proxy(makeRequest(path, makeToken({
        exp: Math.floor(Date.now() / 1000) + 3600,
        is_parent: true,
      }))).status).toBe(200);
    });
  });

  it('clears an expired cookie while redirecting to login', () => {
    const response = proxy(
      makeRequest('/dashboard/tenant', makeToken({ exp: Math.floor(Date.now() / 1000) - 1 }))
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?redirectTo=%2Fdashboard%2Ftenant');
    expect(response.headers.get('set-cookie')).toContain('auth_token=;');
  });

  it('routes a valid parent session away from auth pages to the catalog', () => {
    const response = proxy(
      makeRequest('/login', makeToken({
        exp: Math.floor(Date.now() / 1000) + 3600,
        is_parent: true,
      }))
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/kelas');
  });

  it.each(['/forgot-password', '/reset-password?token=abc'])('serves %s without a session', (path) => {
    expect(proxy(makeRequest(path)).status).toBe(200);
  });

  it.each(['/forgot-password', '/reset-password?token=abc'])('redirects an authenticated user from %s', (path) => {
    const response = proxy(makeRequest(path, makeToken({
      exp: Math.floor(Date.now() / 1000) + 3600,
      is_parent: true,
    })));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/kelas');
  });

  it('keeps tenant sessions out of parent student management', () => {
    const tenantId = '123e4567-e89b-12d3-a456-426614174000';
    const response = proxy(
      makeRequest('/dashboard/parent/students', makeToken({
        exp: Math.floor(Date.now() / 1000) + 3600,
        tenant_id: tenantId,
      }))
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/dashboard/tenant');
  });

  it('serves the invitation link to a visitor without a session', () => {
    const response = proxy(makeRequest('/invitations/verify?token=abc'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('serves the invitation link to a visitor who is already signed in', () => {
    const response = proxy(
      makeRequest('/invitations/verify?token=abc', makeToken({
        exp: Math.floor(Date.now() / 1000) + 3600,
        is_parent: true,
      }))
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('serves the invitation link while clearing an expired session cookie', () => {
    const response = proxy(
      makeRequest('/invitations/verify?token=abc', makeToken({ exp: Math.floor(Date.now() / 1000) - 1 }))
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toContain('auth_token=;');
  });

  describe('payment return landing (KEL-44)', () => {
    const RETURN_PATH = '/dashboard/parent/enrollments/return?merchantOrderId=2d8f7a0c-7a0a-4aa8-8e54-000000000001&resultCode=00&reference=REF1';

    it('sends a returning parent without a session to login with the full return URL', () => {
      const response = proxy(makeRequest(RETURN_PATH));

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get('location') || '');
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('redirectTo')).toBe(RETURN_PATH);
    });

    it('treats an expired session on return the same way and clears the cookie', () => {
      const response = proxy(makeRequest(RETURN_PATH, makeToken({ exp: Math.floor(Date.now() / 1000) - 1, is_parent: true })));

      expect(response.status).toBe(307);
      expect(new URL(response.headers.get('location') || '').searchParams.get('redirectTo')).toBe(RETURN_PATH);
      expect(response.headers.get('set-cookie')).toContain('auth_token=;');
    });

    it('keeps tenant sessions out of the return landing', () => {
      const response = proxy(makeRequest(RETURN_PATH, makeToken({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: '123e4567-e89b-12d3-a456-426614174000' })));

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost/dashboard/tenant');
    });

    it('serves the return landing to a parent session', () => {
      const response = proxy(makeRequest(RETURN_PATH, makeToken({ exp: Math.floor(Date.now() / 1000) + 3600, is_parent: true })));

      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });
  });
});
