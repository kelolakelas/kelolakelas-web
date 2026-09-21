'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { inviteDeliveryMessage } from '@/lib/invitation';
import { inviteMemberSchema, updateMemberRoleSchema } from '../_schemas/schema';

export interface ActionResponse {
  success: boolean;
  message: string;
  /**
   * Whether the invitation email was actually delivered, mirrored from the
   * identity response field `data.email_sent` (KEL-36). Undefined for actions
   * that do not send email and for responses that predate the field.
   */
  emailSent?: boolean;
  errors?: Record<string, string[]>;
  data?: unknown;
}

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
    const baseUrl = getGatewayBaseUrl();
    // 2. Dispatch request to backend identity service
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/invitations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        role_id: roleId,
      }),
      cache: 'no-store',
    });

    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message: result.message || 'Failed to send invitation. Please verify inputs and try again.',
      };
    }

    // 3. Revalidate path to refresh UI cache
    revalidatePath('/dashboard/tenant/members');

    // 4. Surface the real delivery outcome. The identity service stores the
    // invitation even when Resend rejects the send and reports it through
    // `data.email_sent`; the tenant must see the difference (KEL-36). The
    // backend message describes the delivery and wins over the local fallback.
    const data = (result.data ?? {}) as { email_sent?: unknown };
    const emailSent = data.email_sent === true;
    const backendMessage =
      typeof result.message === 'string' ? result.message.trim() : '';

    return {
      success: true,
      emailSent,
      message: backendMessage || inviteDeliveryMessage(emailSent, email),
      data: result.data,
    };
  } catch (error) {
    console.error('[inviteTenantMember Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected connection error occurred while sending the invitation.',
    };
  }
}

/**
 * Server Action: Update a member's assigned role.
 * Endpoint: PUT /api/v1/members/{memberId}/role
 */
export async function updateMemberRole(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    memberId: formData.get('memberId'),
    roleId: formData.get('roleId'),
  };

  // 1. Server-side validation using Zod
  const validation = updateMemberRoleSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed. Please select a valid member and role.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { memberId, roleId } = validation.data;
  try {
    const baseUrl = getGatewayBaseUrl();
    // 2. Dispatch update request to backend identity service
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/members/${memberId}/role`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ role_id: roleId }),
      cache: 'no-store',
    });

    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message: result.message || 'Failed to update member role.',
      };
    }

    // 3. Revalidate path to refresh UI cache
    revalidatePath('/dashboard/tenant/members');

    return {
      success: true,
      message: 'Member role updated successfully.',
      data: result.data,
    };
  } catch (error) {
    console.error('[updateMemberRole Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected connection error occurred while updating member role.',
    };
  }
}
