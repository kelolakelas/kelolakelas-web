import { cookies } from 'next/headers';
import type { Member, Permission, Role } from '../_schemas/schema';

const DEFAULT_API_URL = 'http://localhost:3000';
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * Utility to extract authentication and tenant headers from server cookies.
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
 * Fetches current active members for the tenant organization from the API Gateway.
 */
export async function getTenantMembers(): Promise<Member[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/members`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[getTenantMembers] Non-OK response:', response.status);
      return [];
    }

    const result = await response.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error('[getTenantMembers Error]:', error);
    return [];
  }
}

/**
 * Fetches available roles configured for the tenant organization.
 * Target Endpoint: GET /api/v1/roles
 */
export async function getTenantRoles(): Promise<Role[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/roles`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[getTenantRoles] Non-OK response:', response.status);
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

/**
 * Fetches all available system permissions.
 * Target Endpoint: GET /api/v1/permissions
 */
export async function getSystemPermissions(): Promise<Permission[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/permissions`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[getSystemPermissions] Non-OK response:', response.status);
      return [];
    }

    const result = await response.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error('[getSystemPermissions Error]:', error);
    return [];
  }
}
