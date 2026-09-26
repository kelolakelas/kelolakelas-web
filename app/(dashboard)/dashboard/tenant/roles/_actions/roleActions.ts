'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { createRoleSchema, updateRoleSchema, type ActionResponse } from '../_lib/schema';
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

type RoleMutation = 'update' | 'delete';

/**
 * Reads the backend JSON envelope without letting a non-JSON body (e.g. a proxy
 * error page) turn a mapped 403/404/409 into an unexpected network error.
 */
async function readEnvelope(
  response: Response
): Promise<{ status?: string; message?: string; data?: unknown } | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Maps a refused role mutation to a message the tenant can act on (KEL-83).
 *
 * 403 and 404 get fixed wording because the backend text for them is terse or
 * internal ("Permission denied", "role not found"). 409 keeps the backend
 * message, which already states the conflict (name taken on update, role still
 * assigned to active members on delete), and falls back to equivalent wording
 * when the body carries none.
 */
function roleMutationErrorMessage(
  mutation: RoleMutation,
  status: number,
  backendMessage?: string
): string {
  if (status === 403) {
    return mutation === 'update'
      ? 'You do not have permission to edit this role.'
      : 'You do not have permission to delete this role.';
  }
  if (status === 404) {
    return 'This role no longer exists. It may have been deleted in another session. Refresh the page to see the current roles.';
  }
  if (status === 409) {
    if (backendMessage) {
      return backendMessage;
    }
    return mutation === 'update'
      ? 'Another role already uses this name. Choose a different name.'
      : 'This role is still assigned to active members and cannot be deleted.';
  }
  return (
    backendMessage ||
    (mutation === 'update'
      ? 'Failed to update role. Please verify inputs and try again.'
      : 'Failed to delete role. Please try again.')
  );
}

function revalidateRolePaths() {
  revalidatePath('/dashboard/tenant/roles');
  // The tenant overview shows the Active Roles count.
  revalidatePath('/dashboard/tenant');
}

/**
 * Server Action: Update a custom role's name, description and permissions.
 * Target Endpoint: PUT /api/v1/roles/:id
 *
 * Uses `updateRoleSchema`, which applies the same field rules as the creation
 * form, so an edit cannot save a role the creation form would reject.
 */
export async function updateTenantRole(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    roleId: formData.get('roleId'),
    name: formData.get('name'),
    description: formData.get('description'),
    permissionIds: formData.getAll('permissionIds').map((item) => String(item)),
  };

  const validation = updateRoleSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { roleId, name, description, permissionIds } = validation.data;
  try {
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/roles/${encodeURIComponent(roleId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name,
        description,
        permission_ids: permissionIds,
      }),
      cache: 'no-store',
    });

    const result = await readEnvelope(response);

    if (!response.ok || result?.status !== 'success') {
      // No revalidation on refusal: a 404 refresh would unmount this role's
      // card (and the message with it) before the tenant can read why.
      return {
        success: false,
        message: roleMutationErrorMessage('update', response.status, result?.message),
      };
    }

    revalidateRolePaths();

    return {
      success: true,
      message: `Role "${name}" was updated successfully.`,
      data: result.data,
    };
  } catch (error) {
    console.error('[updateTenantRole Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network error occurred while updating the role.',
    };
  }
}

/**
 * Server Action: Delete a custom role.
 * Target Endpoint: DELETE /api/v1/roles/:id
 *
 * The backend refuses with 409 while the role is assigned to active members;
 * the role then stays in the list and the tenant sees that reason.
 */
export async function deleteTenantRole(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const roleId = String(formData.get('roleId') ?? '').trim();
  const roleName = String(formData.get('roleName') ?? '').trim();

  if (!roleId) {
    return { success: false, message: 'Role ID is required.' };
  }

  try {
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/roles/${encodeURIComponent(roleId)}`, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    });

    const result = await readEnvelope(response);

    if (!response.ok || result?.status !== 'success') {
      return {
        success: false,
        message: roleMutationErrorMessage('delete', response.status, result?.message),
      };
    }

    revalidateRolePaths();

    return {
      success: true,
      message: roleName
        ? `Role "${roleName}" was deleted successfully.`
        : 'Role was deleted successfully.',
    };
  } catch (error) {
    console.error('[deleteTenantRole Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network error occurred while deleting the role.',
    };
  }
}
