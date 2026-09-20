import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from '@/lib/gateway';
import { normalizeListEnvelope } from '@/lib/list-envelope';
import type { Category, ClassEntity, ClassSchedule } from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * Largest page the academic service accepts (`page_size` is capped at 100). The
 * tenant dashboard lists every configured class in one view, so it requests a
 * single full page instead of the service default of 20.
 */
const MAX_PAGE_SIZE = 100;

/**
 * Extracts authorization and tenant headers from server cookies.
 *
 * The tenant is resolved from the session server-side. A tenant identifier sent
 * by the browser is never treated as an authorization source: the API gateway
 * strips client-supplied context headers and the downstream services derive the
 * tenant from the JWT claim only.
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value || '';
  const tenantId = cookieStore.get(TENANT_COOKIE)?.value || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  return headers;
}

/**
 * Shared reader for the tenant-scoped academic list endpoints.
 *
 * These endpoints answer with a paginated envelope
 * (`{"status":"success","data":{"items":[...],"pagination":{...}}}`) that the
 * gateway proxies through unchanged, so the payload is unwrapped with
 * `normalizeListEnvelope` instead of being read as a bare array.
 */
async function fetchTenantList<T>(
  resource: string,
  label: string
): Promise<T[]> {
  const baseUrl = getGatewayBaseUrl();

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${baseUrl}/api/v1/${resource}?page_size=${MAX_PAGE_SIZE}`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.warn(`[${label}] Non-OK response status:`, response.status);
      return [];
    }

    const result = await response.json().catch(() => null);

    if (result?.status !== 'success') {
      return [];
    }

    return normalizeListEnvelope<T>(result.data).items;
  } catch (error) {
    console.error(`[${label} Error]:`, error);
    return [];
  }
}

/**
 * Fetches all academic categories configured for the current tenant.
 */
export async function getCategories(): Promise<Category[]> {
  return fetchTenantList<Category>('categories', 'getCategories');
}

/**
 * Fetches all academic classes created for the current tenant.
 */
export async function getClasses(): Promise<ClassEntity[]> {
  return fetchTenantList<ClassEntity>('classes', 'getClasses');
}

/**
 * Fetches initial recurring schedules for the tenant.
 */
export async function getSchedules(): Promise<ClassSchedule[]> {
  return fetchTenantList<ClassSchedule>('schedules', 'getSchedules');
}
