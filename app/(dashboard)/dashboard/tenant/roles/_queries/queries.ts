import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from '@/lib/gateway';
import type { Permission, Role } from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * Extracts authorization and tenant headers from server cookies.
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
 * Fetches all available system permissions from the Identity API Gateway.
 * Target Endpoint: GET /api/v1/permissions
 */
export async function getAvailablePermissions(): Promise<Permission[]> {
  const baseUrl = getGatewayBaseUrl();

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/permissions`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[getAvailablePermissions] Non-OK status:', response.status);
      return [];
    }

    const result = await response.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error('[getAvailablePermissions Error]:', error);
    return [];
  }
}

/**
 * Fetches all roles (system and custom) configured for the active tenant.
 * Target Endpoint: GET /api/v1/roles
 */
export async function getTenantRoles(): Promise<Role[]> {
  const baseUrl = getGatewayBaseUrl();

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/roles`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[getTenantRoles] Non-OK status:', response.status);
      return [];
    }

    const result = await response.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error('[getTenantRoles Error]:', error);
    return [];
  }
}
