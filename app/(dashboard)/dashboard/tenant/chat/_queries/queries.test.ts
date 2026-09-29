import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contract test for the KEL-124 tenant report list reader.
 *
 * The module cannot reach its real collaborators here: `next/headers` needs a
 * request scope, and the gateway reads go out over `fetch`. Both are replaced
 * with stand-ins that keep the observable contract:
 *
 * - the cookie store answers the two cookie names the reader looks up,
 * - `fetch` is a stub routed by URL, so the test asserts exactly which
 *   report requests a given picker state produces.
 *
 * The behaviours pinned here are the ones the acceptance criteria name:
 * authorization failures surface as `forbidden` (the picker hides itself
 * instead of showing a failure), search and page are forwarded to the backend
 * rather than applied in the browser, malformed rows are skipped instead of
 * taking the list down, and a missing gateway configuration degrades to a
 * retryable message.
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

const { getTenantReports } = await import('./queries');

const GATEWAY_URL = 'http://gateway.test';

const REPORT_ID = '11111111-1111-4111-8111-111111111111';

function pagination(overrides: Record<string, number> = {}) {
  return { page: 1, page_size: 10, total_items: 1, total_pages: 1, ...overrides };
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    title: 'Laporan Ananda Budi',
    created_at: '2026-09-20T10:00:00Z',
    ...overrides,
  };
}

function success(data: unknown) {
  return new Response(JSON.stringify({ status: 'success', message: 'ok', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function failure(status: number, message = 'refused') {
  return new Response(JSON.stringify({ status: 'error', message, data: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type Route = (url: string) => Response | undefined;

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(route: Route) {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const response = route(url);

    if (!response) {
      throw new Error(`Unexpected request in test: ${url}`);
    }

    return response;
  });

  vi.stubGlobal('fetch', fetchMock);
}

function requestedPaths(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function headersOf(path: string): Record<string, string> {
  const call = fetchMock.mock.calls.find((entry) => String(entry[0]) === path);

  return (call?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
}

beforeEach(() => {
  savedGatewayUrl = process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = GATEWAY_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();

  if (savedGatewayUrl === undefined) {
    delete process.env.GATEWAY_API_URL;
  } else {
    process.env.GATEWAY_API_URL = savedGatewayUrl;
  }
});

describe('getTenantReports', () => {
  it('reads one page with the session credentials and normalises every row', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/reports`)) {
        return success({ items: [report()], pagination: pagination() });
      }
      return undefined;
    });

    const result = await getTenantReports({ search: '', page: 1 });

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]).toMatchObject({ id: REPORT_ID, title: 'Laporan Ananda Budi' });
      expect(result.data.pagination.total_pages).toBe(1);
    }

    const [listCall] = requestedPaths();
    expect(listCall).toContain('/api/v1/reports');
    expect(listCall).toContain('page=1');
    expect(listCall).toContain('page_size=10');
    expect(headersOf(listCall)).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
  });

  it('forwards search text and the page to the backend', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/reports`)) {
        return success({ items: [], pagination: pagination({ total_items: 0, total_pages: 0 }) });
      }
      return undefined;
    });

    const result = await getTenantReports({ search: '  Budi  ', page: 3 });

    expect(result.error).toBeNull();
    const [listCall] = requestedPaths();
    expect(listCall).toContain(`search=${encodeURIComponent('Budi')}`);
    expect(listCall).toContain('page=3');
  });

  it('reports 401 and 403 as forbidden so the picker hides itself', async () => {
    for (const status of [401, 403]) {
      installFetch(() => failure(status, 'Permission denied'));

      const result = await getTenantReports({ search: '', page: 1 });

      expect(result.error).toBe('forbidden');
      if (result.error === 'forbidden') {
        expect(result.message).toContain('report:read');
      }
    }
  });

  it('reports other failures as a retryable api state', async () => {
    installFetch(() => failure(500, 'upstream exploded'));

    const result = await getTenantReports({ search: '', page: 1 });

    expect(result.error).toBe('api');
    if (result.error === 'api') {
      expect(result.message).toContain('belum dapat dimuat');
    }
  });

  it('skips malformed rows instead of failing the list', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/reports`)) {
        return success({
          items: [report(), { id: '', title: 'tanpa id' }, null, report({ id: '22222222-2222-4222-8222-222222222222' })],
          pagination: pagination({ total_items: 4 }),
        });
      }
      return undefined;
    });

    const result = await getTenantReports({ search: '', page: 1 });

    expect(result.error).toBeNull();
    if (result.error === null) {
      expect(result.data.items.map((item) => item.id)).toEqual([
        REPORT_ID,
        '22222222-2222-4222-8222-222222222222',
      ]);
    }
  });

  it('degrades a missing gateway configuration to a configuration state', async () => {
    delete process.env.GATEWAY_API_URL;

    const result = await getTenantReports({ search: '', page: 1 });

    expect(result.error).toBe('configuration');
    if (result.error === 'configuration') {
      expect(result.message).toContain('GATEWAY_API_URL');
    }
  });
});
