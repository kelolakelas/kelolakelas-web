import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from '@/lib/gateway';
import { normalizeListEnvelope, type ListPagination } from '@/lib/list-envelope';
import { membersQueryString } from '../_lib/schema';
import type { InvitationListItem, Member, Permission, Role } from '../_schemas/schema';

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
 * Result of reading one page of current active tenant members.
 */
export interface TenantMembersRead {
  members: Member[];
  pagination: ListPagination;
}

/**
 * Fetches one page of current active members for the tenant organization from
 * the API Gateway.
 *
 * Identity returns `data` as `{ items, pagination }`; the normalizer also keeps
 * the older bare-array response readable. Failed and malformed reads degrade to
 * an empty list, matching the existing members screen's non-crashing state.
 */
export async function getTenantMembers(page = 1): Promise<TenantMembersRead> {
  const emptyResult: TenantMembersRead = {
    members: [],
    pagination: { page, page_size: 0, total_items: 0, total_pages: 0 },
  };

  try {
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/members?${membersQueryString(page)}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('[getTenantMembers] Non-OK response:', response.status);
      return emptyResult;
    }

    const result: unknown = await response.json();
    if (
      typeof result !== 'object' ||
      result === null ||
      !('status' in result) ||
      result.status !== 'success' ||
      !('data' in result)
    ) {
      return emptyResult;
    }

    const normalized = normalizeListEnvelope<Member>(result.data);

    return {
      members: normalized.items,
      pagination: normalized.pagination,
    };
  } catch (error) {
    console.error('[getTenantMembers Error]:', error);
    return emptyResult;
  }
}

/**
 * Result of reading the tenant's unredeemed invitations (KEL-84).
 *
 * The page must tell an empty list apart from a caller without `member:invite`
 * (identity answers 403) and from a failed read, so the result is
 * discriminated instead of degrading to an empty array like the member reads.
 */
export type TenantInvitationsRead =
  | { state: 'ok'; invitations: InvitationListItem[] }
  | { state: 'forbidden' }
  | { state: 'error' };

/**
 * Keeps only well-formed invitation rows. A row without an id or email cannot
 * be revoked or resent, so it is dropped instead of rendered half-broken.
 * `status` is taken from identity, which computes it from `expires_at`; any
 * value other than `active` is treated as expired so it is never counted.
 */
function normalizeInvitation(raw: unknown): InvitationListItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id : '';
  const email = typeof item.email === 'string' ? item.email : '';
  if (!id || !email) return null;

  return {
    id,
    email,
    role_id: typeof item.role_id === 'string' ? item.role_id : '',
    expires_at: typeof item.expires_at === 'string' ? item.expires_at : null,
    status: item.status === 'active' ? 'active' : 'expired',
    email_sent: item.email_sent === true,
  };
}

/** Number of invitations that are still pending (not expired). */
export function countActiveInvitations(invitations: InvitationListItem[]): number {
  return invitations.filter((invitation) => invitation.status === 'active').length;
}

/**
 * Fetches the tenant's unredeemed invitations.
 * Target Endpoint: GET /api/v1/invitations
 *
 * Identity answers `data` as a bare array (no pagination), 403 without
 * `member:invite`.
 */
export async function getTenantInvitations(): Promise<TenantInvitationsRead> {
  try {
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/invitations`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (response.status === 403) {
      return { state: 'forbidden' };
    }

    if (!response.ok) {
      console.warn('[getTenantInvitations] Non-OK response:', response.status);
      return { state: 'error' };
    }

    const result: unknown = await response.json();
    if (
      typeof result !== 'object' ||
      result === null ||
      !('status' in result) ||
      result.status !== 'success' ||
      !('data' in result) ||
      !Array.isArray(result.data)
    ) {
      return { state: 'error' };
    }

    const invitations = result.data
      .map(normalizeInvitation)
      .filter((item): item is InvitationListItem => item !== null);

    return { state: 'ok', invitations };
  } catch (error) {
    console.error('[getTenantInvitations Error]:', error);
    return { state: 'error' };
  }
}

/**
 * Fetches available roles configured for the tenant organization.
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
  const baseUrl = getGatewayBaseUrl();

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
