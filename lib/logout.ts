/**
 * Logout helpers shared by the Server Action, the logout control, and their tests.
 *
 * Session state lives entirely in two HTTP-only cookies written by the login and
 * tenant-registration actions. Ending a session therefore means deleting exactly
 * those cookies, so the defaults here mirror the ones used when the cookies are set
 * (`app/(auth)/login/_actions/actions.ts`, `app/(auth)/register/_actions/actions.ts`)
 * and the environment override names stay identical.
 *
 * Limitation: identity exposes no token revocation endpoint, so deleting the cookie
 * only ends the browser session. The JWT itself stays cryptographically valid until
 * its 24-hour expiry, which is why a copied token is not invalidated by logout.
 */

export const DEFAULT_AUTH_COOKIE_NAME = 'auth_token';
export const DEFAULT_TENANT_COOKIE_NAME = 'tenant_id';

/** Where a user lands after a successful logout. `/login` is reachable without a session. */
export const LOGOUT_DESTINATION = '/login';

export interface LogoutActionState {
  success: boolean;
  message: string;
}

export const INITIAL_LOGOUT_STATE: LogoutActionState = { success: false, message: '' };

/**
 * Mirrors the `process.env.NAME || default` resolution used when the session cookies
 * are written, so logout always removes the cookies that login actually created,
 * including when a deployment renames them through the environment.
 */
function resolveCookieName(rawName: string | undefined, fallback: string) {
  return rawName || fallback;
}

/**
 * Returns the cookie names that make up a session, without duplicates in case a
 * deployment points both variables at the same name.
 */
export function sessionCookieNames(env: Record<string, string | undefined>): string[] {
  const authCookieName = resolveCookieName(env.AUTH_COOKIE_NAME, DEFAULT_AUTH_COOKIE_NAME);
  const tenantCookieName = resolveCookieName(env.TENANT_ID_COOKIE_NAME, DEFAULT_TENANT_COOKIE_NAME);

  return authCookieName === tenantCookieName ? [authCookieName] : [authCookieName, tenantCookieName];
}

/** The slice of `cookies()` that logout needs, so the behaviour can be tested directly. */
export interface SessionCookieStore {
  delete(name: string): unknown;
}

/**
 * Deletes every session cookie. It is intentionally unconditional: the logout control
 * is rendered on authenticated pages, but a session can already be gone — an expired
 * cookie the proxy cleared, a second open tab that signed out first, or a login that
 * failed after the view rendered. Deleting an absent cookie is a no-op that raises no
 * error, so signing out twice stays silent instead of failing the screen.
 */
export function clearSessionCookies(
  cookieStore: SessionCookieStore,
  env: Record<string, string | undefined>
): string[] {
  const cookieNames = sessionCookieNames(env);

  for (const cookieName of cookieNames) {
    cookieStore.delete(cookieName);
  }

  return cookieNames;
}

