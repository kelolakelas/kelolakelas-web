import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { MINIMUM_SAFE_NAV_ITEMS, filterTenantNavItems } from '../_lib/nav';
import type { NavItem } from '../_constants/constants';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/** The caller's own membership as answered by `GET /api/v1/members/me/membership`. */
export interface TenantMembership {
  member_id: string;
  role_id: string;
  role_name: string;
  permissions: string[];
}

export type TenantNavRead =
  | { state: 'ok'; items: readonly NavItem[]; roleName: string; membership: TenantMembership }
  | { state: 'forbidden' | 'api' | 'configuration'; items: readonly NavItem[]; roleName: null; membership: null };

function failure(state: 'forbidden' | 'api' | 'configuration'): TenantNavRead {
  return { state, items: MINIMUM_SAFE_NAV_ITEMS, roleName: null, membership: null };
}

/**
 * Reads the caller's own membership through the gateway and decides the tenant
 * dashboard navigation (KEL-136).
 *
 * Only a `2xx` answer whose envelope `status` is `success` counts, mirroring the
 * settings queries: a gateway error page that still parses as JSON must not be
 * mistaken for usable data. Every read failure falls back to the minimum safe
 * menu and is classified so the shell can tell a permission problem (403/401)
 * apart from a backend or configuration one.
 */
export async function readTenantNav(): Promise<TenantNavRead> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value || '';
  const tenantId = cookieStore.get(TENANT_COOKIE)?.value || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;

  let response: Response;
  try {
    response = await fetch(`${getGatewayBaseUrl()}/api/v1/members/me/membership`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
  } catch (error) {
    return failure(getGatewayConfigurationErrorMessage(error) ? 'configuration' : 'api');
  }

  const body: unknown = await response.json().catch(() => null);
  const envelope = body as { status?: unknown; data?: unknown } | null;
  if (!response.ok || envelope?.status !== 'success') {
    return failure(response.status === 403 || response.status === 401 ? 'forbidden' : 'api');
  }

  const data = envelope.data as Partial<TenantMembership> | null | undefined;
  if (!data || typeof data.role_name !== 'string' || !Array.isArray(data.permissions)) {
    return failure('api');
  }

  const permissions = data.permissions.filter((name): name is string => typeof name === 'string');
  const membership: TenantMembership = {
    member_id: typeof data.member_id === 'string' ? data.member_id : '',
    role_id: typeof data.role_id === 'string' ? data.role_id : '',
    role_name: data.role_name,
    permissions,
  };

  return {
    state: 'ok',
    items: filterTenantNavItems(permissions),
    roleName: membership.role_name,
    membership,
  };
}
