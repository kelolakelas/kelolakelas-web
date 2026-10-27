'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { clearSessionCookies } from '@/lib/logout';
import { invitationReturnPath } from '@/lib/invitation';

import {
  INVITATION_SUCCESS_REDIRECT,
  invitationRegisterErrorMessage,
  invitedUserRegistrationSchema,
} from '@/lib/invitation';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage, withGatewayClientIp } from '@/lib/gateway';

export interface InvitationActionState {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  redirectTo?: string;
}

export async function acceptExistingInvitation(_previous: InvitationActionState, form: FormData): Promise<InvitationActionState> {
  const token = form.get('token');
  if (typeof token !== 'string' || !token.trim() || token.length > 255) return { success: false, message: 'Tautan undangan tidak lengkap.' };
  const accessToken = (await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  const login = `/login?redirectTo=${encodeURIComponent(invitationReturnPath(token))}`;
  if (!accessToken) return { success: false, message: 'Sesi berakhir. Masuk dengan email yang diundang, lalu coba lagi.', redirectTo: login };
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/invitations/accept`, {
      method: 'POST', cache: 'no-store',
      headers: await withGatewayClientIp({ 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }),
      body: JSON.stringify({ token }),
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.status === 'success' && result.data?.member_id) {
      revalidatePath('/dashboard/tenant', 'layout');
      return { success: true, message: 'Undangan diterima. Buka dashboard lalu pilih tenant baru melalui Pilih tenant.' };
    }
    if (response.status === 401) return { success: false, message: 'Sesi berakhir. Masuk kembali dengan email yang diundang.', redirectTo: login };
    if (response.status === 403) return { success: false, message: 'Gunakan akun Teacher aktif dengan email yang sama dengan undangan. Akun ini tidak dapat menerima undangan tersebut.' };
    if (response.status === 409) return { success: false, message: 'Undangan sudah digunakan/dicabut, atau membership nonaktif. Periksa dashboard atau hubungi admin tenant.' };
    if (response.status === 400 || response.status === 404) return { success: false, message: 'Undangan kedaluwarsa atau tidak ditemukan. Minta admin mengirim ulang.' };
    return { success: false, message: 'Undangan belum dapat diproses. Coba lagi; konteks undangan tetap tersimpan.' };
  } catch {
    return { success: false, message: 'Layanan tidak dapat dihubungi. Coba lagi; konteks undangan tetap tersimpan.' };
  }
}

export async function signInForInvitation(form: FormData) {
  const token = form.get('token');
  if (typeof token !== 'string' || !token.trim() || token.length > 255) return;
  clearSessionCookies(await cookies(), process.env);
  revalidatePath('/', 'layout');
  redirect(`/login?redirectTo=${encodeURIComponent(invitationReturnPath(token))}`);
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
      headers: await withGatewayClientIp({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
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
