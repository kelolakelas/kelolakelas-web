import { describe, expect, it, vi } from 'vitest';
import {
  clearSessionCookies,
  DEFAULT_AUTH_COOKIE_NAME,
  DEFAULT_TENANT_COOKIE_NAME,
  LOGOUT_DESTINATION,
  sessionCookieNames,
} from './logout';

/**
 * Session cookies are written by login and tenant registration with
 * `process.env.NAME || default` resolution. Logout must resolve the same names, or a
 * deployment that renames a cookie would leave the session cookie behind and keep the
 * user signed in. These cases pin that resolution.
 */
describe('session cookie names', () => {
  it('falls back to the defaults used when the session cookies are written', () => {
    expect(sessionCookieNames({})).toEqual([DEFAULT_AUTH_COOKIE_NAME, DEFAULT_TENANT_COOKIE_NAME]);
    expect(sessionCookieNames({ AUTH_COOKIE_NAME: '', TENANT_ID_COOKIE_NAME: '' })).toEqual([
      DEFAULT_AUTH_COOKIE_NAME,
      DEFAULT_TENANT_COOKIE_NAME,
    ]);
  });

  it('honours cookie names configured through the environment', () => {
    expect(sessionCookieNames({ AUTH_COOKIE_NAME: 'session_jwt' })).toEqual([
      'session_jwt',
      DEFAULT_TENANT_COOKIE_NAME,
    ]);
    expect(
      sessionCookieNames({ AUTH_COOKIE_NAME: 'session_jwt', TENANT_ID_COOKIE_NAME: 'active_tenant' })
    ).toEqual(['session_jwt', 'active_tenant']);
  });

  it('never deletes the same cookie twice when both names are configured identically', () => {
    expect(
      sessionCookieNames({ AUTH_COOKIE_NAME: 'shared', TENANT_ID_COOKIE_NAME: 'shared' })
    ).toEqual(['shared']);
  });
});

describe('logout destination', () => {
  it('points at the public login route so logout is reachable without a session', () => {
    expect(LOGOUT_DESTINATION).toBe('/login');
  });
});

describe('clearing the session', () => {
  it('deletes the auth cookie and the tenant cookie', () => {
    const cookieStore = { delete: vi.fn() };

    clearSessionCookies(cookieStore, {});

    expect(cookieStore.delete.mock.calls).toEqual([[DEFAULT_AUTH_COOKIE_NAME], [DEFAULT_TENANT_COOKIE_NAME]]);
  });

  it('deletes cookies under the configured environment names', () => {
    const cookieStore = { delete: vi.fn() };

    clearSessionCookies(cookieStore, {
      AUTH_COOKIE_NAME: 'session_jwt',
      TENANT_ID_COOKIE_NAME: 'active_tenant',
    });

    expect(cookieStore.delete.mock.calls).toEqual([['session_jwt'], ['active_tenant']]);
  });

  it('tolerates a session cookie that is already gone', () => {
    // Models the already-signed-out cases: an expired cookie the proxy cleared, a
    // second tab that signed out first, or a view rendered before a failed login.
    const present = new Set([DEFAULT_AUTH_COOKIE_NAME, DEFAULT_TENANT_COOKIE_NAME]);
    const cookieStore = {
      delete: vi.fn((name: string) => {
        // Deleting an absent cookie is a no-op in the real cookie store.
        present.delete(name);
      }),
    };

    clearSessionCookies(cookieStore, {});
    expect([...present]).toEqual([]);

    // A second logout — another open tab, or a stale back-button view — must stay quiet.
    expect(() => clearSessionCookies(cookieStore, {})).not.toThrow();
    expect(cookieStore.delete).toHaveBeenCalledTimes(4);
  });

  it('tolerates a session that never existed', () => {
    const present = new Set<string>();
    const cookieStore = {
      delete: vi.fn((name: string) => {
        present.delete(name);
      }),
    };

    expect(() => clearSessionCookies(cookieStore, {})).not.toThrow();
    expect(present.size).toBe(0);
  });

  it('deletes a configured shared cookie name only once', () => {
    const cookieStore = { delete: vi.fn() };

    clearSessionCookies(cookieStore, { AUTH_COOKIE_NAME: 'shared', TENANT_ID_COOKIE_NAME: 'shared' });

    expect(cookieStore.delete.mock.calls).toEqual([['shared']]);
  });
});
