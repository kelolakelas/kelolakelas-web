import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logoutAction } from './actions';

/**
 * Integration test for the logout Server Action.
 *
 * The action cannot be exercised through its real collaborators in this
 * environment: `next/headers` requires a request scope, and `next/navigation`'s
 * `redirect` throws a control-flow signal that only the framework catches. Both
 * are replaced with stand-ins that keep the same observable contract as the
 * Next.js implementations:
 *
 * - the cookie store tolerates deleting a name that was never set (upstream
 *   `ResponseCookies.delete` unconditionally writes an already-expired cookie),
 * - `redirect` is recorded instead of thrown.
 */

const deletedNames: string[] = [];
let presentCookies = new Set<string>();

const deleteCookie = vi.fn((name: string) => {
  deletedNames.push(name);
  // Mirrors the real store: removing an absent cookie is a silent no-op.
  presentCookies.delete(name);
});

const cookieSet = vi.fn((name: string) => {
  presentCookies.add(name);
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    delete: deleteCookie,
    set: cookieSet,
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    // Real `redirect` throws to unwind rendering; the action's contract is only
    // that it is invoked with the destination, so it is recorded and returned.
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { redirect } = await import('next/navigation');
const { revalidatePath } = await import('next/cache');

const ENV_KEYS = ['AUTH_COOKIE_NAME', 'TENANT_ID_COOKIE_NAME'] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  vi.clearAllMocks();
  deletedNames.length = 0;
  presentCookies = new Set(['auth_token', 'tenant_id']);
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('logoutAction', () => {
  it('clears both session cookies and sends the user to login', async () => {
    await logoutAction();

    expect(deletedNames).toEqual(['auth_token', 'tenant_id']);
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('purges the client cache so the protected page is not served from cache', async () => {
    await logoutAction();

    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('leaves no session cookies behind', async () => {
    await logoutAction();

    expect([...presentCookies]).toEqual([]);
  });

  it('clears the cookie names configured through the environment', async () => {
    process.env.AUTH_COOKIE_NAME = 'session_jwt';
    process.env.TENANT_ID_COOKIE_NAME = 'active_tenant';
    presentCookies = new Set(['session_jwt', 'active_tenant', 'auth_token']);

    await logoutAction();

    expect(deletedNames).toEqual(['session_jwt', 'active_tenant']);
    // A cookie written under a different configured name is not ours to remove.
    expect([...presentCookies]).toEqual(['auth_token']);
  });

  it('resolves without error when no session cookie exists', async () => {
    presentCookies = new Set();

    await expect(logoutAction()).resolves.toBeUndefined();
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('stays quiet when a second tab signs out again', async () => {
    await logoutAction();
    await expect(logoutAction()).resolves.toBeUndefined();

    expect(redirect).toHaveBeenCalledTimes(2);
  });
});
