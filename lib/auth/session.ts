import { cookies } from 'next/headers';
import { isTokenExpired } from './token';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

export async function hasValidSession(): Promise<boolean> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  return Boolean(token && !isTokenExpired(token));
}