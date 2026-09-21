import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the tenant settings reader (KEL-34).
 *
 * The module cannot reach its real collaborators here: `next/headers` needs a
 * request scope, and the gateway reads go out over `fetch`. Both are replaced
 * with stand-ins that keep the observable contract:
 *
 * - the cookie store answers the two cookie names the reader looks up,
 * - `fetch` is a stub routed by URL, so the test asserts exactly which identity
 *   requests a given page load produces.
 *
 * The behaviours pinned here are the ones the acceptance criteria name:
 * authorization failures surface as `forbidden` rather than as a technical
 * error, and a tenant without a location row still gets an editable profile
 * form instead of an error page.
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

const { getTenantSettings } = await import('./queries');

const GATEWAY_URL = 'http://gateway.test';
const SETTINGS_PATH = `${GATEWAY_URL}/api/v1/tenant/settings`;
const LOCATION_PATH = `${GATEWAY_URL}/api/v1/tenant/settings/location`;

const PROFILE = {
  id: '9f1b1d5e-0a2c-4b3d-8e4f-5a6b7c8d9e0f',
  name: 'Bimbel Nusantara',
  phone: '08123456789',
  address: 'Jl. Merdeka 1',
  about: 'Bimbel untuk kelas 4-6',
};

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

/** Requests the reader made, in order. */
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

describe('getTenantSettings', () => {
  it('returns the profile and location with the session headers attached', async () => {
    installFetch((url) => {
      if (url === SETTINGS_PATH) return success(PROFILE);
      if (url === LOCATION_PATH) {
        return success({ address: 'Jl. Merdeka 1', latitude: -6.2, longitude: 106.8166667 });
      }
      return undefined;
    });

    const result = await getTenantSettings();

    expect(result.error).toBeNull();
    expect(result.profile).toEqual(PROFILE);
    expect(result.location?.latitude).toBe(-6.2);

    // The tenant is never taken from the browser: both requests carry the
    // session token, and the header is context the gateway republishes from the
    // verified claim.
    expect(headersOf(SETTINGS_PATH).Authorization).toBe('Bearer session-token');
    expect(headersOf(LOCATION_PATH)['X-Tenant-ID']).toBe('tenant-1');
  });

  it('still returns the profile when the tenant has no location yet', async () => {
    installFetch((url) => {
      if (url === SETTINGS_PATH) return success(PROFILE);
      if (url === LOCATION_PATH) return failure(404, 'Tenant location not found');
      return undefined;
    });

    const result = await getTenantSettings();

    expect(result.error).toBeNull();
    expect(result.profile?.name).toBe('Bimbel Nusantara');
    expect(result.location).toBeNull();
  });

  it('keeps the profile usable when the location endpoint fails for any reason', async () => {
    installFetch((url) => {
      if (url === SETTINGS_PATH) return success(PROFILE);
      if (url === LOCATION_PATH) return failure(500, 'boom');
      return undefined;
    });

    const result = await getTenantSettings();

    expect(result.error).toBeNull();
    expect(result.profile).not.toBeNull();
  });

  it('reports 403 as a permission state, not as a technical failure', async () => {
    installFetch(() => failure(403, 'Permission denied'));

    const result = await getTenantSettings();

    expect(result.error).toBe('forbidden');
    expect(result.message).toContain('tenant:update');
    expect(result.profile).toBeNull();
  });

  it('reports 401 as a permission state because the session is unusable', async () => {
    installFetch(() => failure(401, 'Authorization required'));

    const result = await getTenantSettings();

    expect(result.error).toBe('forbidden');
    expect(result.profile).toBeNull();
  });

  it('reports a backend failure as an api error', async () => {
    installFetch(() => failure(500, 'boom'));

    const result = await getTenantSettings();

    expect(result.error).toBe('api');
    expect(result.profile).toBeNull();
  });

  it('does not read the location when the profile itself could not be read', async () => {
    installFetch(() => failure(500, 'boom'));

    await getTenantSettings();

    // An editable location form above a failed profile would invite an update
    // that rebases on state the tenant cannot see.
    expect(requestedPaths()).toEqual([SETTINGS_PATH]);
  });

  it('reports an unconfigured gateway without attempting a request', async () => {
    delete process.env.GATEWAY_API_URL;
    installFetch(() => success(PROFILE));

    const result = await getTenantSettings();

    expect(result.error).toBe('configuration');
    expect(result.message).toContain('GATEWAY_API_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
