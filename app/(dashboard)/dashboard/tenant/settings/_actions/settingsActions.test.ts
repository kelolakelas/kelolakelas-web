import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the tenant settings Server Actions (KEL-34).
 *
 * The actions cannot reach their real collaborators here: `next/headers` needs a
 * request scope, `next/cache` needs a render scope, and the updates go out over
 * `fetch`. All three are replaced, and what is asserted is the observable
 * contract the acceptance criteria depend on:
 *
 * - the exact request body identity receives, including that a blank optional
 *   field is omitted rather than sent as an empty string,
 * - that a validation failure never reaches the network,
 * - that `403` is reported as a permission state and other failures keep the
 *   backend's own message.
 *
 * `next/headers`, `next/cache`, and `@/lib/gateway` are mocked through
 * `vi.mock` rather than by stubbing globals because the actions import them by
 * module path.
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

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }));

const { updateTenantProfile, updateTenantLocation } = await import('./settingsActions');
const { EMPTY_TENANT_SETTINGS_ACTION_STATE } = await import('../_lib/schema');

const GATEWAY_URL = 'http://gateway.test';
const PROFILE_PATH = `${GATEWAY_URL}/api/v1/tenant/settings`;
const LOCATION_PATH = `${GATEWAY_URL}/api/v1/tenant/settings/location`;

function success(data: unknown = {}) {
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

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(response: Response | (() => Response)) {
  fetchMock = vi.fn(async () =>
    typeof response === 'function' ? response() : response
  );
  vi.stubGlobal('fetch', fetchMock);
}

function formDataOf(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

function bodyOfLastRequest(): Record<string, unknown> {
  const call = fetchMock.mock.calls.at(-1);
  const init = call?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
}

beforeEach(() => {
  savedGatewayUrl = process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = GATEWAY_URL;
  revalidatePath.mockClear();
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

describe('updateTenantProfile', () => {
  it('sends the profile fields and revalidates the screen on success', async () => {
    installFetch(success());

    const state = await updateTenantProfile(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({
        name: '  Bimbel Nusantara ',
        phone: '08123456789',
        address: 'Jl. Merdeka 1',
        about: 'Bimbel untuk kelas 4-6',
      })
    );

    expect(state.status).toBe('success');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(PROFILE_PATH);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('PATCH');
    expect(bodyOfLastRequest()).toEqual({
      name: 'Bimbel Nusantara',
      phone: '08123456789',
      address: 'Jl. Merdeka 1',
      about: 'Bimbel untuk kelas 4-6',
    });
    // Without the revalidation the server-rendered form would keep showing the
    // previous values after a save.
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/settings');
  });

  it('omits optional fields that were left blank so a stored value is not cleared', async () => {
    installFetch(success());

    await updateTenantProfile(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ name: 'Bimbel Nusantara', phone: '', address: '   ', about: '' })
    );

    const body = bodyOfLastRequest();
    expect(body).toEqual({ name: 'Bimbel Nusantara' });
    expect('phone' in body).toBe(false);
    expect('about' in body).toBe(false);
  });

  it('never reaches the network when validation fails', async () => {
    installFetch(success());

    const state = await updateTenantProfile(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ name: '   ' })
    );

    expect(state.status).toBe('error');
    expect(state.errors?.name?.[0]).toBe('Nama tenant wajib diisi.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a missing permission as a permission state', async () => {
    installFetch(failure(403, 'Permission denied'));

    const state = await updateTenantProfile(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ name: 'Bimbel Nusantara' })
    );

    expect(state.status).toBe('forbidden');
    expect(state.message).toContain('tenant:update');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reports an expired session as a session problem', async () => {
    installFetch(failure(401, 'Authorization required'));

    const state = await updateTenantProfile(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ name: 'Bimbel Nusantara' })
    );

    expect(state.status).toBe('error');
    expect(state.message).toContain('Sesi Anda sudah berakhir');
  });

  it("keeps the backend's message when it names the cause", async () => {
    // A name conflict is only knowable by the backend, so its message is shown
    // rather than replaced by a generic one.
    installFetch(failure(500, 'tenant name already exists'));

    const state = await updateTenantProfile(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ name: 'Bimbel Nusantara' })
    );

    expect(state.status).toBe('error');
    expect(state.message).toBe('tenant name already exists');
  });

  it('fails when the envelope reports an error even on a 2xx status', async () => {
    installFetch(
      new Response(JSON.stringify({ status: 'error', message: 'no', data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const state = await updateTenantProfile(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ name: 'Bimbel Nusantara' })
    );

    expect(state.status).toBe('error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('updateTenantLocation', () => {
  it('sends the address alone so the backend geocodes it', async () => {
    installFetch(success({ address: 'Jl. Merdeka 1', latitude: -6.2, longitude: 106.8 }));

    const state = await updateTenantLocation(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ address: 'Jl. Merdeka 1', latitude: '', longitude: '' })
    );

    expect(state.status).toBe('success');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('PUT');
    const body = bodyOfLastRequest();
    expect(body.address).toBe('Jl. Merdeka 1');
    expect('latitude' in body).toBe(false);
    expect('longitude' in body).toBe(false);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/settings');
  });

  it('sends a coordinate pair as numbers rather than form text', async () => {
    installFetch(success());

    await updateTenantLocation(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({
        address: 'Jl. Merdeka 1',
        latitude: '-6.2000000',
        longitude: '106.8166667',
      })
    );

    expect(bodyOfLastRequest()).toEqual({
      address: 'Jl. Merdeka 1',
      latitude: -6.2,
      longitude: 106.8166667,
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(LOCATION_PATH);
  });

  it('refuses a lone coordinate before it reaches the network', async () => {
    installFetch(success());

    const state = await updateTenantLocation(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ address: 'Jl. Merdeka 1', latitude: '-6.2', longitude: '' })
    );

    expect(state.status).toBe('error');
    expect(state.errors?.longitude?.[0]).toBe(
      'Latitude dan longitude harus diisi bersamaan.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a missing permission as a permission state without revalidating', async () => {
    installFetch(failure(403, 'Permission denied'));

    const state = await updateTenantLocation(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ address: 'Jl. Merdeka 1' })
    );

    expect(state.status).toBe('forbidden');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reports a geocoding failure with the backend message', async () => {
    // Geocoding is optional on the backend, so its failure is a real outcome the
    // tenant has to be told about instead of being given a generic error.
    installFetch(failure(500, 'geocoding service unavailable'));

    const state = await updateTenantLocation(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ address: 'Jl. Merdeka 1' })
    );

    expect(state.status).toBe('error');
    expect(state.message).toBe('geocoding service unavailable');
  });

  it('reports an unavailable authorization lookup separately from a denial', async () => {
    installFetch(failure(503, 'Failed to update tenant location'));

    const state = await updateTenantLocation(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ address: 'Jl. Merdeka 1' })
    );

    expect(state.status).toBe('error');
    expect(state.message).toContain('Layanan otorisasi');
  });

  it('reports an unconfigured gateway without attempting a request', async () => {
    delete process.env.GATEWAY_API_URL;
    installFetch(success());

    const state = await updateTenantLocation(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ address: 'Jl. Merdeka 1' })
    );

    expect(state.status).toBe('error');
    expect(state.message).toContain('GATEWAY_API_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a network failure instead of throwing', async () => {
    fetchMock = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    vi.stubGlobal('fetch', fetchMock);

    const state = await updateTenantLocation(
      EMPTY_TENANT_SETTINGS_ACTION_STATE,
      formDataOf({ address: 'Jl. Merdeka 1' })
    );

    expect(state.status).toBe('error');
    expect(state.message.length).toBeGreaterThan(0);
  });
});
