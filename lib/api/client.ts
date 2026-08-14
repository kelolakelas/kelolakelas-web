import 'server-only';

import { getTokenStatus } from '@/lib/auth/token';
import { cookies } from 'next/headers';
import { ApiError, getApiErrorCode, getSafeApiMessage } from './errors';
import type { ApiEnvelope, PaginatedData, QueryResult } from './types';

const DEFAULT_API_URL = 'http://localhost:3000';
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
}

interface ApiRequestInit extends RequestInit {
  includeTenant?: boolean;
  requiresAuth?: boolean;
  next?: { revalidate?: number; tags?: string[] };
}

async function getRequestHeaders(headers?: HeadersInit, includeTenant = true, requiresAuth = false): Promise<Headers> {
  const cookieStore = await cookies();
  const requestHeaders = new Headers(headers);
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const tenantId = includeTenant ? cookieStore.get(TENANT_COOKIE)?.value : undefined;

  requestHeaders.set('Accept', 'application/json');
  if (!requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json');
  const tokenStatus = getTokenStatus(token);
  if (requiresAuth && tokenStatus === 'missing') throw new ApiError('Request tidak memiliki Authorization.', 401, 'missing_authorization');
  if (requiresAuth && tokenStatus === 'expired') throw new ApiError('Sesi Anda telah berakhir.', 401, 'token_expired');
  if (requiresAuth && tokenStatus === 'invalid') throw new ApiError('Token autentikasi tidak valid.', 401, 'token_invalid');
  if (tokenStatus === 'valid') requestHeaders.set('Authorization', `Bearer ${token}`);
  if (tenantId) requestHeaders.set('X-Tenant-ID', tenantId);
  return requestHeaders;
}

async function readJson<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return { status: response.ok ? 'success' : 'error' };
  }
}

export async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: await getRequestHeaders(init.headers, init.includeTenant, init.requiresAuth),
      cache: init.cache || (init.next ? undefined : 'no-store'),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      console.warn('[apiRequest auth]', { method: init.method || 'GET', path, code: error.code });
    }
    throw error;
  }
  const result = await readJson<T>(response);

  if (!response.ok || result.status !== 'success') {
    const code = getApiErrorCode(response.status, result.message);
    console.warn('[apiRequest]', { method: init.method || 'GET', path, status: response.status, code });
    if (code === 'token_expired' || code === 'token_invalid') {
      const cookieStore = await cookies();
      cookieStore.delete(AUTH_COOKIE);
      cookieStore.delete(TENANT_COOKIE);
    }
    throw new ApiError(getSafeApiMessage(response.status, result.message, code), response.status, code);
  }
  return result;
}

export function unwrapList<T>(data: T[] | PaginatedData<T> | undefined): QueryResult<T[]> {
  if (Array.isArray(data)) return { data };
  return { data: data?.items || [], pagination: data?.pagination };
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE;
}

export function getTenantCookieName(): string {
  return TENANT_COOKIE;
}

export type { ApiEnvelope, AuthData, PaginatedData, QueryResult } from './types';
