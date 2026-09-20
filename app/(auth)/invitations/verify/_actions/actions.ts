'use server';

import {
  INVITATION_SUCCESS_REDIRECT,
  invitationRegisterErrorMessage,
  invitedUserRegistrationSchema,
} from '@/lib/invitation';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';

export interface InvitationActionState {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  redirectTo?: string;
}

/**
 * Server Action: Complete registration from a tenant invitation.
 * Endpoint: POST /api/v1/invitations/register
 *
 * The action is the only writer of the registration payload, and the token
 * travels as a form field rather than a query parameter so it never lands in
 * the page URL, the browser history or an access log of the web app. The
 * invitation row remains the authority on the address, tenant and role: the
 * payload sends only what the invited person is allowed to decide.
 */
export async function registerInvitedUser(
  _prevState: InvitationActionState,
  formData: FormData
): Promise<InvitationActionState> {
  const rawData = {
    token: formData.get('token'),
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    password: formData.get('password'),
  };

  const validation = invitedUserRegistrationSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  try {
    const baseUrl = getGatewayBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/invitations/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(validation.data),
      cache: 'no-store',
    });

    const result = (await response.json().catch(() => null)) as
      | { status?: string; message?: string }
      | null;

    if (!response.ok || result?.status !== 'success') {
      return {
        success: false,
        message: invitationRegisterErrorMessage(response.status, result?.message),
      };
    }

    return {
      success: true,
      message: 'Your account has been created.',
      redirectTo: INVITATION_SUCCESS_REDIRECT,
    };
  } catch (error) {
    console.error('[registerInvitedUser Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected connection error occurred while creating your account.',
    };
  }
}
