'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getGatewayBaseUrl } from '@/lib/gateway';

type State = { message: string; ready?: boolean; secret?: string; purpose?: 'enroll' | 'verify' };
const pendingName = 'platform_pending';
const challengeName = 'platform_challenge';
const purposeName = 'platform_purpose';

async function request(path: string, body: object, token?: string) {
  const response = await fetch(`${getGatewayBaseUrl()}/api/v1/platform/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), cache: 'no-store',
  });
  if (!response.ok) return null;
  return (await response.json()).data;
}

export async function platformLogin(_state: State, form: FormData): Promise<State> {
  const email = form.get('email'); const password = form.get('password');
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return { message: 'Enter your credentials.' };
  try {
    const data = await request('login', { email, password });
    if (!data?.token) return { message: 'Invalid credentials or authentication unavailable.' };
    (await cookies()).set(pendingName, data.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/platform', maxAge: 300 });
  } catch { return { message: 'Authentication unavailable. Try again later.' }; }
  redirect('/platform/challenge');
}

export async function beginFactor(_state: State, form: FormData): Promise<State> {
  const purpose = form.get('purpose');
  if (purpose !== 'enroll' && purpose !== 'verify') return { message: 'Invalid request.' };
  const token = (await cookies()).get(pendingName)?.value;
  if (!token) return { message: 'Session expired. Sign in again.' };
  try {
    const data = await request('challenge', { purpose }, token);
    if (!data?.challenge) return { message: purpose === 'enroll' ? 'Enrollment requires operator authorization or authentication is unavailable.' : 'Factor unavailable or authentication expired.' };
    const jar = await cookies();
    jar.set(challengeName, data.challenge, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/platform', maxAge: 300 });
    jar.set(purposeName, purpose, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/platform', maxAge: 300 });
    return { message: '', ready: true, secret: data.secret || undefined, purpose };
  } catch { return { message: 'Authentication unavailable. Try again later.' }; }
}

export async function finishFactor(_state: State, form: FormData): Promise<State> {
  const code = form.get('code');
  const jar = await cookies();
  const purpose = jar.get(purposeName)?.value;
  const challenge = jar.get(challengeName)?.value;
  const token = jar.get(pendingName)?.value;
  if (!token || (purpose !== 'enroll' && purpose !== 'verify') || !challenge || typeof code !== 'string' || !/^\d{6}$/.test(code)) return { message: 'Session expired or code invalid. Start again.' };
  try {
    const data = await request('verify', { purpose, challenge, code }, token);
    if (!data?.token) return { message: 'Code invalid, expired, or unavailable. Retry or start a new challenge.' };
    jar.delete(pendingName); jar.delete(challengeName); jar.delete(purposeName);
    jar.set(process.env.AUTH_COOKIE_NAME || 'auth_token', data.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 86400 });
  } catch { return { message: 'Authentication unavailable. Try again later.' }; }
  redirect('/platform');
}
