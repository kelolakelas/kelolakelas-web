'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getGatewayBaseUrl, withGatewayClientIp } from '@/lib/gateway';
import { clearSessionCookies } from '@/lib/logout';
import { confirmResetSchema, requestResetSchema } from '../_schemas/schema';

export interface ResetActionState {
  message: string;
  errors?: Record<string, string[]>;
  invalidToken?: boolean;
}

const gatewayError = 'Layanan sedang mengalami gangguan. Silakan coba lagi nanti.';
const invalidToken = 'Tautan reset tidak valid atau sudah kedaluwarsa.';

export async function requestPasswordReset(
  _previous: ResetActionState,
  formData: FormData
): Promise<ResetActionState> {
  const parsed = requestResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { message: 'Periksa kembali alamat email Anda.', errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/auth/password-reset/request`, {
      method: 'POST',
      headers: await withGatewayClientIp({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
    if (response.status >= 500) return { message: gatewayError };
    if (!response.ok) return { message: 'Permintaan belum dapat diproses. Silakan coba lagi nanti.' };
  } catch {
    return { message: gatewayError };
  }

  // Identical confirmation for registered and unknown addresses; never echo email or gateway body.
  redirect('/forgot-password?sent=1');
}

export async function confirmPasswordReset(
  _previous: ResetActionState,
  formData: FormData
): Promise<ResetActionState> {
  const parsed = confirmResetSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      message: errors.token ? invalidToken : 'Periksa kembali password Anda.',
      errors,
      invalidToken: Boolean(errors.token),
    };
  }

  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/auth/password-reset/confirm`, {
      method: 'POST',
      headers: await withGatewayClientIp({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify({ token: parsed.data.token, password: parsed.data.password }),
      cache: 'no-store',
    });
    if (response.status >= 500) return { message: gatewayError };
    if (response.status === 400) return { message: invalidToken, invalidToken: true };
    if (!response.ok) return { message: 'Permintaan belum dapat diproses. Silakan coba lagi nanti.' };
    clearSessionCookies(await cookies(), process.env);
  } catch {
    return { message: gatewayError };
  }

  // Next redirects throw; keep navigation outside the network-error handler.
  redirect('/login?reset=1');
}
