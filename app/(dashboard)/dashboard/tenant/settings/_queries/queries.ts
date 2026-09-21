import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import {
  isForbiddenStatus,
  isUnauthorizedStatus,
  TENANT_SETTINGS_API_ERROR_MESSAGE,
  TENANT_SETTINGS_CONFIGURATION_FALLBACK,
  TENANT_SETTINGS_FORBIDDEN_MESSAGE,
  type TenantLocation,
  type TenantProfile,
  type TenantSettingsResult,
} from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * Extracts authorization and tenant headers from server cookies.
 *
 * The tenant is resolved from the session server-side; a tenant identifier sent
 * by the browser is never treated as an authorization source. The identity
 * service derives the tenant from the JWT claim only, so a forged header cannot
 * change whose settings are read or written.
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

interface Read<T> {
  status: number;
  ok: boolean;
  data: T | null;
}

/**
 * Reads one settings endpoint.
 *
 * Only a `2xx` answer whose envelope `status` is `success` counts as usable.
 * The body is checked rather than trusted because a gateway error page or a
 * proxy timeout still parses as JSON in some deployments, and reading `data`
 * off it would yield `undefined` instead of a failure the caller can classify.
 */
async function readJson<T>(path: string, headers: HeadersInit): Promise<Read<T>> {
  const response = await fetch(`${getGatewayBaseUrl()}${path}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const body: unknown = await response.json().catch(() => null);
  const envelope = body as { status?: unknown; data?: unknown } | null;
  const succeeded = response.ok && envelope?.status === 'success';

  return {
    status: response.status,
    ok: succeeded,
    data: succeeded ? ((envelope?.data ?? null) as T | null) : null,
  };
}

/**
 * Whether the read failure was an authorization problem rather than a backend one.
 *
 * A `404` is deliberately not treated as "no settings yet": identity seeds a
 * tenant row at registration, so a missing row means the tenant claim points at
 * nothing and the page must not render an empty editable form over it.
 */
function classify(status: number): 'forbidden' | 'api' | null {
  if (isUnauthorizedStatus(status) || isForbiddenStatus(status)) return 'forbidden';
  if (status >= 400) return 'api';
  return null;
}

/**
 * Reads the tenant profile and, independently, its location.
 *
 * The two live behind separate endpoints and a tenant legitimately has no
 * location yet, so a missing location must not fail the page. The profile is
 * the primary content: when it cannot be read the location is not used at all,
 * because an editable location form above a failed profile would invite an
 * update that rebases on state the tenant cannot see.
 */
export async function getTenantSettings(): Promise<TenantSettingsResult> {
  let headers: HeadersInit;

  try {
    headers = await getAuthHeaders();
  } catch (error) {
    const configurationMessage = getGatewayConfigurationErrorMessage(error);
    return {
      profile: null,
      location: null,
      error: 'configuration',
      message: configurationMessage ?? TENANT_SETTINGS_CONFIGURATION_FALLBACK,
    };
  }

  let profileRead: Read<TenantProfile>;

  try {
    profileRead = await readJson<TenantProfile>('/api/v1/tenant/settings', headers);
  } catch (error) {
    const configurationMessage = getGatewayConfigurationErrorMessage(error);
    return {
      profile: null,
      location: null,
      error: 'configuration',
      message: configurationMessage ?? TENANT_SETTINGS_CONFIGURATION_FALLBACK,
    };
  }

  const profileFailure = classify(profileRead.status);

  if (profileFailure === 'forbidden') {
    return {
      profile: null,
      location: null,
      error: 'forbidden',
      message: TENANT_SETTINGS_FORBIDDEN_MESSAGE,
    };
  }

  if (profileFailure === 'api' || !profileRead.data) {
    return {
      profile: null,
      location: null,
      error: 'api',
      message: TENANT_SETTINGS_API_ERROR_MESSAGE,
    };
  }

  let location: TenantLocation | null = null;

  try {
    const locationRead = await readJson<TenantLocation>(
      '/api/v1/tenant/settings/location',
      headers
    );
    // A location row is created on first update, so a missing one is expected
    // and leaves the form empty rather than failing the page. Any other failure
    // is also tolerated here: the profile is what the screen is for.
    if (locationRead.ok && locationRead.data) {
      location = locationRead.data;
    }
  } catch {
    location = null;
  }

  return { profile: profileRead.data, location, error: null, message: null };
}
