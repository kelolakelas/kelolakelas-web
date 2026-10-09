'use server';

import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage, withGatewayClientIp } from '@/lib/gateway';
import { parentRegisterSchema, tenantRegisterSchema } from '../_schemas/schema';

export interface ActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  redirectTo?: string;
  values?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    tenant_name?: string;
    tenant_address?: string;
    tenant_phone?: string;
  };
}

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

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

  const values = {
    first_name: textField(formData, 'first_name'),
    last_name: textField(formData, 'last_name'),
    email: textField(formData, 'email'),
    phone: textField(formData, 'phone'),
  };
  const validatedFields = parentRegisterSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      success: false,
      values,
      message: 'Validation failed. Please check the form errors.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const baseUrl = getGatewayBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: await withGatewayClientIp({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify(validatedFields.data),
      cache: 'no-store',
    });

    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        values,
        message: result.message || 'Registration failed. Please try again.',
      };
    }

    return {
      success: true,
      message: 'Parent account registered successfully. Please sign in to continue.',
      redirectTo: '/login?registered=1',
    };
  } catch (error) {
    console.error('[registerParent Error]:', error);
    return {
      success: false,
      values,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected connection error occurred. Please try again later.',
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

  const values = {
    first_name: textField(formData, 'first_name'),
    last_name: textField(formData, 'last_name'),
    email: textField(formData, 'email'),
    phone: textField(formData, 'phone'),
    tenant_name: textField(formData, 'tenant_name'),
    tenant_address: textField(formData, 'tenant_address'),
    tenant_phone: textField(formData, 'tenant_phone'),
  };
  const validatedFields = tenantRegisterSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      success: false,
      values,
      message: 'Validation failed. Please check the form errors.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const baseUrl = getGatewayBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/tenants/register`, {
      method: 'POST',
      headers: await withGatewayClientIp({
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify(validatedFields.data),
      cache: 'no-store',
    });

    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        values,
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

      if (result.data.tenant_id) {
        cookieStore.set(process.env.TENANT_ID_COOKIE_NAME || 'tenant_id', result.data.tenant_id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        });
      }
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
      values,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected connection error occurred. Please try again later.',
    };
  }
}
