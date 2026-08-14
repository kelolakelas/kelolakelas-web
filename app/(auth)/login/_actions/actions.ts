'use server';

import { apiRequest, getAuthCookieName, getTenantCookieName } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { LoginResponse } from '@/lib/api/types';
import { getSafeRedirect } from '@/lib/auth/redirect';
import { decodeTokenClaims } from '@/lib/auth/token';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginSchema } from '../_schemas/schema';

export interface ActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

const COOKIE_MAX_AGE = 60 * 60 * 24;

/**
 * Server Action for user authentication against the identity service API.
 * Validates credentials with Zod schema, issues request to identity service,
 * and sets an HTTP-only authentication cookie upon success.
 */
export async function loginAction(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  // 1. Validate Form Input with Zod Schema
  const validatedFields = loginSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Validation failed. Please correct the errors in the form.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validatedFields.data;
  const cookieName = getAuthCookieName();
  let destination: string;

  try {
    // 2. Request Authentication from Backend Identity Service
    const result = await apiRequest<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      includeTenant: false,
      body: JSON.stringify({ email, password }),
    });

    if (!result.data?.token || !result.data.user) throw new ApiError('Respons login tidak lengkap.', 502);

    const tokenClaims = decodeTokenClaims(result.data.token);
    const tenantId = result.data.tenant_id || result.data.user.tenant_id || tokenClaims.tenant_id;
    const isParent = result.data.user.is_parent === true || tokenClaims.is_parent === true || tokenClaims.role === 'parent';
    if (!isParent && !tenantId) {
      return { success: false, message: 'Login berhasil, tetapi tenant context tidak tersedia. Hubungi administrator.' };
    }

    // 3. Persist JWT Token in Secure HTTP-Only Cookie
    const cookieStore = await cookies();
    cookieStore.set(cookieName, result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });

    if (isParent) {
      cookieStore.delete(getTenantCookieName());
    } else if (tenantId) {
      cookieStore.set(
        getTenantCookieName(),
        tenantId,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: COOKIE_MAX_AGE,
        }
      );
    }

    const fallback = isParent ? '/dashboard/parent' : '/dashboard/tenant';
    const requestedDestination = getSafeRedirect(formData.get('redirectTo'), fallback);
    destination = isParent
      ? requestedDestination.startsWith('/classes/') ? requestedDestination : '/dashboard/parent'
      : requestedDestination.startsWith('/dashboard/parent') || requestedDestination.startsWith('/classes/')
        ? '/dashboard/tenant'
        : requestedDestination;
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, message: error.message };
    }
    console.error('[loginAction Error]:', error);
    return {
      success: false,
      message: 'An unexpected connection error occurred. Please try again later.',
    };
  }
  redirect(destination);
}
