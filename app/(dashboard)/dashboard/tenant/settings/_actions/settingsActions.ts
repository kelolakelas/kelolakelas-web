'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import {
  TENANT_SETTINGS_API_ERROR_MESSAGE,
  TENANT_SETTINGS_CONFIGURATION_FALLBACK,
  tenantLocationSchema,
  tenantProfileSchema,
  tenantSettingsErrorMessage,
  textToAbout,
  type TenantSettingsActionState,
} from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

const SETTINGS_PATH = '/dashboard/tenant/settings';

/**
 * Extracts authorization and tenant headers from server cookies.
 *
 * Re-read inside every action because a Server Action is a separate entry point
 * reachable by a direct POST: the page-level session gate does not cover it.
 * The identity service resolves the tenant from the JWT claim only, so the
 * header below is context for the gateway and never an authorization source.
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

function configurationFailure(error: unknown): TenantSettingsActionState {
  const configurationMessage = getGatewayConfigurationErrorMessage(error);
  return {
    status: 'error',
    message: configurationMessage ?? TENANT_SETTINGS_CONFIGURATION_FALLBACK,
  };
}

/**
 * Reads the backend's own message from a failed response body.
 *
 * Identity names the rejected value for most validation failures (for example
 * `tenant name already exists`), so its message is preferred over a generic one.
 * The handler-level texts that name no cause are filtered out by
 * `tenantSettingsErrorMessage`, which keeps the screen from showing
 * `Failed to update tenant settings` as if it were an explanation.
 */
async function readBackendMessage(response: Response): Promise<string | null> {
  const body: unknown = await response.json().catch(() => null);
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : null;
}

function failureState(status: number, backendMessage: string | null): TenantSettingsActionState {
  const message = tenantSettingsErrorMessage(status, backendMessage);

  if (status === 403) {
    return { status: 'forbidden', message };
  }

  return { status: 'error', message };
}

/**
 * Server Action: update the tenant profile.
 *
 * Endpoint: `PATCH /api/v1/tenant/settings` (name required; phone, address, and
 * about optional and omitted when blank so a stored value is not replaced by an
 * empty string). The endpoint is guarded by `tenant:update`, so `403` is an
 * expected outcome for a member without it and is reported as a permission
 * state rather than as a failure.
 */
export async function updateTenantProfile(
  _prevState: TenantSettingsActionState,
  formData: FormData
): Promise<TenantSettingsActionState> {
  const validation = tenantProfileSchema.safeParse({
    name: formData.get('name')?.toString() ?? '',
    phone: formData.get('phone')?.toString() ?? '',
    address: formData.get('address')?.toString() ?? '',
    about: formData.get('about')?.toString() ?? '',
  });

  if (!validation.success) {
    return {
      status: 'error',
      message: 'Periksa kembali isian yang ditandai.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const about = textToAbout(validation.data.about ?? '');
  const payload = {
    name: validation.data.name,
    phone: validation.data.phone,
    address: validation.data.address,
    // `about` is a JSON column, so a typed value is sent as a JSON string — the
    // shape registration writes and the catalog already renders.
    about,
  };

  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/tenant/settings`, {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!response.ok) {
      return failureState(response.status, await readBackendMessage(response));
    }

    const body: unknown = await response.json().catch(() => null);
    if ((body as { status?: unknown } | null)?.status !== 'success') {
      return { status: 'error', message: TENANT_SETTINGS_API_ERROR_MESSAGE };
    }

    revalidatePath(SETTINGS_PATH);
    return { status: 'success', message: 'Profil tenant berhasil disimpan.' };
  } catch (error) {
    return configurationFailure(error);
  }
}

/**
 * Server Action: update the tenant location.
 *
 * Endpoint: `PUT /api/v1/tenant/settings/location` (address required, latitude
 * and longitude optional but only as a pair). The backend geocodes an address
 * when coordinates are omitted, and geocoding is optional there, so a geocoding
 * failure is reported with the backend's own message rather than being replaced
 * by a generic one.
 */
export async function updateTenantLocation(
  _prevState: TenantSettingsActionState,
  formData: FormData
): Promise<TenantSettingsActionState> {
  const validation = tenantLocationSchema.safeParse({
    address: formData.get('address')?.toString() ?? '',
    latitude: formData.get('latitude')?.toString() ?? '',
    longitude: formData.get('longitude')?.toString() ?? '',
  });

  if (!validation.success) {
    return {
      status: 'error',
      message: 'Periksa kembali isian yang ditandai.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const payload = {
    address: validation.data.address,
    latitude: validation.data.latitude,
    longitude: validation.data.longitude,
  };

  try {
    const response = await fetch(
      `${getGatewayBaseUrl()}/api/v1/tenant/settings/location`,
      {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return failureState(response.status, await readBackendMessage(response));
    }

    const body: unknown = await response.json().catch(() => null);
    if ((body as { status?: unknown } | null)?.status !== 'success') {
      return { status: 'error', message: TENANT_SETTINGS_API_ERROR_MESSAGE };
    }

    revalidatePath(SETTINGS_PATH);
    return { status: 'success', message: 'Lokasi tenant berhasil disimpan.' };
  } catch (error) {
    return configurationFailure(error);
  }
}
