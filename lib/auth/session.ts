import { cookies } from 'next/headers';
import { decodeTokenClaims, getDashboardRole, isTokenExpired, type DashboardRole } from './token';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

export async function hasValidSession(): Promise<boolean> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  return Boolean(token && !isTokenExpired(token));
}

export async function getSessionRole(): Promise<DashboardRole> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token || isTokenExpired(token)) return 'unknown';
  try {
    return getDashboardRole(decodeTokenClaims(token));
  } catch {
    return 'unknown';
  }
}