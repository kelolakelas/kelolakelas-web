import { getGatewayBaseUrl, withGatewayClientIp } from './gateway';
import type { CatalogResult } from './catalog';

export type PublicTenant = { id: string; name: string; address?: string; latitude?: number; longitude?: number };

export async function getPublicTenant(id: string): Promise<CatalogResult<PublicTenant>> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { error: 'not_found' };
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/tenants/${encodeURIComponent(id)}/public`, {
      cache: 'no-store', headers: await withGatewayClientIp({ Accept: 'application/json' }),
    });
    if (response.status === 404) return { error: 'not_found' };
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.status !== 'success' || body.data?.id !== id || typeof body.data?.name !== 'string') return { error: 'api' };
    return { data: body.data as PublicTenant };
  } catch {
    return { error: 'api' };
  }
}
