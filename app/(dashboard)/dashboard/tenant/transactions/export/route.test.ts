import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { GET } from './route';

/**
 * KEL-148 CSV export proxy.
 *
 * The browser must never see the gateway token: this route forwards the
 * session cookies server-side to `GET /api/v1/billing/transactions/export`
 * with exactly the filter parameters the list shows (`transactionExportQuery`
 * builds both). The behaviours pinned here: the forwarded request carries the
 * same filter as the list, the upstream CSV bytes and disposition pass
 * through, and refusals (bad filter, over-long range, forbidden, outage)
 * surface as JSON with the matching status instead of an empty file.
 */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'auth_token') return { name, value: 'session-token' };
      if (name === 'tenant_id') return { name, value: 'tenant-1' };
      return undefined;
    },
  })),
}));

const GATEWAY_URL = 'http://gateway.test';

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function request(query: string) {
  return new NextRequest(`${GATEWAY_URL}/dashboard/tenant/transactions/export?${query}`);
}

function csv(body: string, disposition = 'attachment; filename="transactions-2026-08-29_to_2026-09-27.csv"') {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': disposition },
  });
}

function upstreamError(status: number) {
  return new Response(JSON.stringify({ status: 'error', message: 'no', data: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  savedGatewayUrl = process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = GATEWAY_URL;
  fetchMock = vi.fn(async () => csv('order_id,status\norder-1,paid\n'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (savedGatewayUrl === undefined) {
    delete process.env.GATEWAY_API_URL;
  } else {
    process.env.GATEWAY_API_URL = savedGatewayUrl;
  }
});

describe('transaction export route (KEL-148)', () => {
  it('forwards the active list filter to the billing export with the session token', async () => {
    const response = await GET(request('status=paid&date_from=2026-08-29&date_to=2026-09-27&search=order-1'));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('order-1');
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('.csv');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(`${GATEWAY_URL}/api/v1/billing/transactions/export`);
    expect(parsed.searchParams.get('date_by')).toBe('paid_at');
    expect(parsed.searchParams.get('status')).toBe('paid');
    expect(parsed.searchParams.get('search')).toBe('order-1');
    expect(parsed.searchParams.get('date_from')).toBe('2026-08-29');
    expect(parsed.searchParams.get('date_to')).toBe('2026-09-27');
    expect(parsed.searchParams.has('page')).toBe(false);
    expect(init).toMatchObject({
      method: 'GET',
      headers: { Authorization: 'Bearer session-token', 'X-Tenant-ID': 'tenant-1' },
    });
  });

  it('rejects an invalid filter without any upstream request', async () => {
    const response = await GET(request('status=all&date_from=2026-08-29&date_to=2026-09-27'));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the 366-day refusal as a 400 explanation', async () => {
    fetchMock.mockResolvedValueOnce(upstreamError(400));

    const response = await GET(request('status=paid&date_from=2024-01-01&date_to=2026-09-27'));

    expect(response.status).toBe(400);
    expect((await response.json())).toMatchObject({ status: 'error' });
  });

  it('surfaces a missing billing:read as 403 and an outage as 502', async () => {
    fetchMock.mockResolvedValueOnce(upstreamError(403));
    await expect(
      GET(request('status=paid&date_from=2026-08-29&date_to=2026-09-27')),
    ).resolves.toMatchObject({ status: 403 });

    fetchMock.mockResolvedValueOnce(upstreamError(500));
    await expect(
      GET(request('status=paid&date_from=2026-08-29&date_to=2026-09-27')),
    ).resolves.toMatchObject({ status: 502 });
  });
});
