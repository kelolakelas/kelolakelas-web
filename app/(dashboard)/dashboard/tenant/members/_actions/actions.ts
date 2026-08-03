'use server';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { revalidatePath } from 'next/cache';
import { inviteMemberSchema } from '../_schemas/schema';

export interface ActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: unknown;
}

/**
 * Server Action: Invite a new tenant member.
 * Endpoint: POST /api/v1/invitations
 */
export async function inviteTenantMember(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const permissionIdsRaw = formData.getAll('permissionIds');

  const rawData = {
    email: formData.get('email'),
    roleId: formData.get('roleId'),
    permissionIds: permissionIdsRaw.length > 0 ? permissionIdsRaw : [],
  };

  // 1. Server-side validation using Zod
  const validation = inviteMemberSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { email, roleId } = validation.data;
  try {
    const result = await apiRequest('/api/v1/invitations', {
      method: 'POST',
      body: JSON.stringify({
        email,
        role_id: roleId,
      }),
    });

    // 3. Revalidate path to refresh UI cache
    revalidatePath('/dashboard/tenant/members');

    return {
      success: true,
      message: `Invitation successfully sent to ${email}.`,
      data: result.data,
    };
  } catch (error) {
    if (error instanceof ApiError) return { success: false, message: error.message };
    console.error('[inviteTenantMember Error]:', error);
    return {
      success: false,
      message: 'An unexpected connection error occurred while sending the invitation.',
    };
  }
}

export async function updateMemberRole(_previous: ActionResponse, formData: FormData): Promise<ActionResponse> {
  const memberId = String(formData.get('member_id') || '');
  const roleId = String(formData.get('role_id') || '');
  if (!memberId || !roleId) return { success: false, message: 'Member dan role wajib dipilih.' };
  try {
    await apiRequest(`/api/v1/members/${memberId}/role`, { method: 'PUT', body: JSON.stringify({ role_id: roleId }) });
    revalidatePath('/dashboard/tenant/members');
    return { success: true, message: 'Role member berhasil diperbarui.' };
  } catch (error) {
    return { success: false, message: error instanceof ApiError ? error.message : 'Role member gagal diperbarui.' };
  }
}

