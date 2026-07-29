'use server';

import { cookies } from 'next/headers';
import { parentRegisterSchema, tenantRegisterSchema } from './schema';

export interface ActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  redirectTo?: string;
}

const DEFAULT_API_URL = 'http://localhost:3000';
const DEFAULT_COOKIE_NAME = 'auth_token';

/**
 * Server Action for Parent User Registration.
 * Target Endpoint: POST /api/v1/auth/register
 */
export async function registerParent(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    phone: formData.get('phone') || undefined,
    is_parent: true,
  };

  const validatedFields = parentRegisterSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Validation failed. Please check the form errors.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

  try {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(validatedFields.data),
      cache: 'no-store',
    });

    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message: result.message || 'Registration failed. Please try again.',
      };
    }

    if (result.data?.token) {
      const cookieStore = await cookies();
      cookieStore.set(process.env.AUTH_COOKIE_NAME || DEFAULT_COOKIE_NAME, result.data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return {
      success: true,
      message: 'Parent account registered successfully.',
      redirectTo: '/dashboard/parent',
    };
  } catch (error) {
    console.error('[registerParent Error]:', error);
    return {
      success: false,
      message: 'An unexpected connection error occurred. Please try again later.',
    };
  }
}

/**
 * Server Action for Tenant Organization & Owner Registration.
 * Target Endpoint: POST /api/v1/tenants/register
 */
export async function registerTenant(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    phone: formData.get('phone') || undefined,
    tenant_name: formData.get('tenant_name'),
    tenant_address: formData.get('tenant_address') || undefined,
    tenant_phone: formData.get('tenant_phone') || undefined,
  };

  const validatedFields = tenantRegisterSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Validation failed. Please check the form errors.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

  try {
    const response = await fetch(`${baseUrl}/api/v1/tenants/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(validatedFields.data),
      cache: 'no-store',
    });

    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message: result.message || 'Tenant registration failed. Please try again.',
      };
    }

    if (result.data?.token) {
      const cookieStore = await cookies();
      cookieStore.set(process.env.AUTH_COOKIE_NAME || DEFAULT_COOKIE_NAME, result.data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    return {
      success: true,
      message: 'Tenant account registered successfully.',
      redirectTo: '/dashboard/tenant',
    };
  } catch (error) {
    console.error('[registerTenant Error]:', error);
    return {
      success: false,
      message: 'An unexpected connection error occurred. Please try again later.',
    };
  }
}
