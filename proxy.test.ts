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
});
