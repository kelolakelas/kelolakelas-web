import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from '@/lib/gateway';

type Caller = { tenant_id?: unknown; is_parent?: unknown; is_platform_admin?: unknown; platform_factor_version?: unknown };

export function creatorCaller(token: string): Caller | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return typeof payload === 'object' && payload !== null ? payload as Caller : null;
  } catch { return null; }
}

export function callerMatchesScope(token: string, platform: boolean, tenant?: string): boolean {
  const caller = creatorCaller(token);
  if (!caller) return false;
  if (platform) return caller.is_platform_admin === true && !caller.tenant_id && typeof caller.platform_factor_version === 'number' && caller.platform_factor_version > 0;
  return caller.is_platform_admin !== true && caller.is_parent !== true && typeof tenant === 'string' && tenant.length > 0 && caller.tenant_id === tenant;
}


export type CreatorRequest = {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  requester_user_id: string;
  target_email: string;
  target_user_id?: string;
  reason: string;
  status: string;
  created_at: string;
  updated_at: string;
  decided_by?: string;
  decided_at?: string;
  rejection_reason?: string;
};

export type RequestResult = { status: number; data: CreatorRequest[]; message: string };

export async function readCreatorRequests(platform: boolean): Promise<RequestResult> {
  const jar = await cookies();
  const token = jar.get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  if (!token) return { status: 401, data: [], message: 'Session expired. Sign in again.' };
  const tenant = jar.get(process.env.TENANT_ID_COOKIE_NAME || 'tenant_id')?.value;
  if (!callerMatchesScope(token, platform, tenant)) return { status: 403, data: [], message: platform ? 'Platform access required.' : 'Tenant access required.' };
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/${platform ? 'platform/' : ''}creator-requests`, {
      headers: { Authorization: `Bearer ${token}`, ...(platform ? {} : { 'X-Tenant-ID': tenant! }) },
      cache: 'no-store',
    });
    if (!response.ok) return { status: response.status, data: [], message: response.status === 403 ? 'Access denied.' : response.status === 401 ? 'Session expired. Sign in again.' : 'Could not load Creator requests. Try again.' };
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('status' in body) || body.status !== 'success' || !('data' in body) || !Array.isArray(body.data)) throw new Error('Invalid Creator request response');
    return { status: 200, data: body.data as CreatorRequest[], message: '' };
  } catch {
    return { status: 503, data: [], message: 'Could not load Creator requests. Try again.' };
  }
}
