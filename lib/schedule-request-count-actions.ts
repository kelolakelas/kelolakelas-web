'use server';

import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from './gateway';
import { readChatUnreadScope } from './chat-unread-scope';
import { readTenantNav } from '@/app/(dashboard)/dashboard/tenant/_queries/membership';

/** Pending-only, capped at the navigation display threshold; never an uncapped total. */
export async function readPendingScheduleRequestCount(expectedScope: string): Promise<{ count: number | null }> {
  try {
    if (!expectedScope || await readChatUnreadScope() !== expectedScope) return { count: null };
    const nav = await readTenantNav();
    if (nav.state !== 'ok' || !nav.membership.permissions.includes('enrollment:read')) return { count: null };
    const jar = await cookies();
    const token = jar.get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
    const tenant = jar.get(process.env.TENANT_ID_COOKIE_NAME || 'tenant_id')?.value;
    if (!token || !tenant) return { count: null };
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/schedule-requests?status=pending`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenant, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { count: null };
    const body = await response.json();
    if (body?.status !== 'success' || !Array.isArray(body.data)) return { count: null };
    // Reject a malformed/unfiltered answer instead of silently dropping rows and claiming zero.
    const ids = new Set<string>();
    for (const row of body.data) {
      if (!row || typeof row.id !== 'string' || row.status !== 'pending' || row.tenant_id !== tenant || ids.has(row.id)) return { count: null };
      ids.add(row.id);
    }
    return { count: Math.min(100, ids.size) };
  } catch {
    return { count: null };
  }
}
