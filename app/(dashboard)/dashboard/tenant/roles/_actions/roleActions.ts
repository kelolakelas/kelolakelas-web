'use server';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { revalidatePath } from 'next/cache';
import { createRoleSchema, updateRoleSchema, type ActionResponse } from '../_lib/schema';
import { getAvailablePermissions as fetchAvailablePermissions, getTenantRoles as fetchTenantRoles } from '../_queries/queries';


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
    const result = await apiRequest('/api/v1/roles', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        permission_ids: permissionIds,
      }),
    });

    // 3. Revalidate paths to update UI cache
    revalidatePath('/dashboard/tenant/roles');
    revalidatePath('/(dashboard)/tenant/roles');

    return {
      success: true,
      message: `Role "${name}" was created successfully.`,
      data: result.data,
    };
  } catch (error) {
    if (error instanceof ApiError) return { success: false, message: error.message };
    console.error('[createTenantRole Error]:', error);
    return {
      success: false,
      message: 'An unexpected network error occurred while creating the role.',
    };
  }
}

export async function updateTenantRole(
  _previous: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const validation = updateRoleSchema.safeParse({
    roleId: formData.get('roleId'),
    name: formData.get('name'),
    description: formData.get('description') || '',
    permissionIds: formData.getAll('permissionIds').map(String),
  });
  if (!validation.success) return { success: false, message: 'Data role belum valid.', errors: validation.error.flatten().fieldErrors };

  try {
    const result = await apiRequest(`/api/v1/roles/${validation.data.roleId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: validation.data.name,
        description: validation.data.description,
        permission_ids: validation.data.permissionIds,
      }),
    });
    revalidatePath('/dashboard/tenant/roles');
    return { success: true, message: 'Role berhasil diperbarui.', data: result.data };
  } catch (error) {
    if (error instanceof ApiError) return { success: false, message: error.message };
    console.error('[updateTenantRole Error]:', error);
    return { success: false, message: 'Role gagal diperbarui.' };
  }
}

export async function deleteTenantRole(
  _previous: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const roleId = String(formData.get('roleId') || '');
  if (!roleId) return { success: false, message: 'Role tidak valid.' };
  try {
    const roles = await fetchTenantRoles();
    const role = roles.data.find((item) => item.id === roleId);
    if (role?.is_system_role) return { success: false, message: 'System role tidak boleh dihapus.' };
    await apiRequest(`/api/v1/roles/${roleId}`, { method: 'DELETE' });
    revalidatePath('/dashboard/tenant/roles');
    return { success: true, message: 'Role berhasil dihapus.' };
  } catch (error) {
    if (error instanceof ApiError) return { success: false, message: error.message };
    console.error('[deleteTenantRole Error]:', error);
    return { success: false, message: 'Role gagal dihapus.' };
  }
}
