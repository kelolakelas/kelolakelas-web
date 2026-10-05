import { afterEach, expect, it, vi } from 'vitest';
import { getPublicTenant } from './public-tenant';
vi.mock('./gateway', () => ({ getGatewayBaseUrl: () => 'https://gateway.test', withGatewayClientIp: async (headers: object) => headers }));
const id = '00000000-0000-0000-0000-000000000001';
afterEach(() => vi.restoreAllMocks());
it('uses the public GET contract without authentication and with no stale cache', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'success', data: { id, name: 'School' } })));
  expect(await getPublicTenant(id)).toEqual({ data: { id, name: 'School' } });
  expect(fetch).toHaveBeenCalledWith(`https://gateway.test/api/v1/tenants/${id}/public`, { cache: 'no-store', headers: { Accept: 'application/json' } });
});
it('rejects invalid IDs locally', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  expect(await getPublicTenant('../private')).toEqual({ error: 'not_found' });
  expect(fetch).not.toHaveBeenCalled();
});
it('distinguishes missing, failures and malformed responses', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  fetch.mockResolvedValueOnce(new Response('', { status: 404 }));
  expect(await getPublicTenant(id)).toEqual({ error: 'not_found' });
  fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
  expect(await getPublicTenant(id)).toEqual({ error: 'api' });
  fetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'success', data: { id: 'other', name: 'School' } })));
  expect(await getPublicTenant(id)).toEqual({ error: 'api' });
  fetch.mockRejectedValueOnce(new Error('offline'));
  expect(await getPublicTenant(id)).toEqual({ error: 'api' });
});
