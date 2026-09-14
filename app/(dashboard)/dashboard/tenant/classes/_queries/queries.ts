import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from '@/lib/gateway';
import type { Category, ClassEntity, ClassSchedule } from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

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
 * Fetches all academic categories configured for the current tenant.
 */
export async function getCategories(): Promise<Category[]> {
  const baseUrl = getGatewayBaseUrl();

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/categories`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[getCategories] Non-OK response status:', response.status);
      return [];
    }

    const result = await response.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error('[getCategories Error]:', error);
    return [];
  }
}

/**
 * Fetches all academic classes created for the current tenant.
 */
export async function getClasses(): Promise<ClassEntity[]> {
  const baseUrl = getGatewayBaseUrl();

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/classes`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[getClasses] Non-OK response status:', response.status);
      return [];
    }

    const result = await response.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error('[getClasses Error]:', error);
    return [];
  }
}

/**
 * Fetches initial recurring schedules for the tenant.
 */
export async function getSchedules(): Promise<ClassSchedule[]> {
  const baseUrl = getGatewayBaseUrl();

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/schedules`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[getSchedules] Non-OK response status:', response.status);
      return [];
    }

    const result = await response.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error('[getSchedules Error]:', error);
    return [];
  }
}
