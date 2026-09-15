'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { createRoleSchema, type ActionResponse } from '../_lib/schema';
import { getAvailablePermissions as fetchAvailablePermissions, getTenantRoles as fetchTenantRoles } from '../_queries/queries';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * Extracts authorization and tenant headers from server cookies.
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

/**
 * Data-fetching helper to retrieve available permissions for the form.
 */
export async function getAvailablePermissions() {
  return fetchAvailablePermissions();
}

/**
 * Data-fetching helper to retrieve current tenant roles.
 */
export async function getTenantRoles() {
  return fetchTenantRoles();
}

/**
 * Server Action: Create a new custom role with assigned permission IDs.
 * Target Endpoint: POST /api/v1/roles
 */
export async function createTenantRole(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const rawPermissionIds = formData.getAll('permissionIds').map((item) => String(item));

  const rawData = {
    name: formData.get('name'),
    description: formData.get('description'),
    permissionIds: rawPermissionIds.length > 0 ? rawPermissionIds : [],
  };

  // 1. Validate payload using Zod schema
  const validation = createRoleSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { name, description, permissionIds } = validation.data;
  try {
    const baseUrl = getGatewayBaseUrl();
    // 2. Dispatch creation payload to backend identity service
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/roles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        description,
        permission_ids: permissionIds,
      }),
      cache: 'no-store',
    });

    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message: result.message || 'Failed to create role. Please verify inputs and try again.',
      };
    }

    // 3. Revalidate paths to update UI cache
    revalidatePath('/dashboard/tenant/roles');
    revalidatePath('/(dashboard)/tenant/roles');

    return {
      success: true,
      message: `Role "${name}" was created successfully.`,
      data: result.data,
    };
  } catch (error) {
    console.error('[createTenantRole Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network error occurred while creating the role.',
    };
  }
}
