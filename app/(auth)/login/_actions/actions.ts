'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginSchema } from '../_schemas/schema';

export interface ActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

const DEFAULT_API_URL = 'http://localhost:3000';
const DEFAULT_COOKIE_NAME = 'auth_token';

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
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  const cookieName = process.env.AUTH_COOKIE_NAME || DEFAULT_COOKIE_NAME;

  let isLoginSuccessful = false;

  try {
    // 2. Request Authentication from Backend Identity Service
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    const result = await response.json();

    if (!response.ok || result.status !== 'success' || !result.data?.token) {
      return {
        success: false,
        message: result.message || 'Invalid email or password. Please try again.',
      };
    }

    // 3. Persist JWT Token in Secure HTTP-Only Cookie
    const cookieStore = await cookies();
    cookieStore.set(cookieName, result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 Days
    });

    isLoginSuccessful = true;
  } catch (error) {
    console.error('[loginAction Error]:', error);
    return {
      success: false,
      message: 'An unexpected connection error occurred. Please try again later.',
    };
  }

  // 4. Redirect Authenticated User to Dashboard
  if (isLoginSuccessful) {
    redirect('/dashboard');
  }

  return {
    success: false,
    message: 'Authentication failed.',
  };
}
