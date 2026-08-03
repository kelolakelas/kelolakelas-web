'use server';

import { apiRequest, getAuthCookieName, getTenantCookieName } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { ParentRegistrationResponse, TenantRegistrationResponse } from '@/lib/api/types';
import { cookies } from 'next/headers';
import { parentRegisterSchema, tenantRegisterSchema } from '../_schemas/schema';

export interface ActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  redirectTo?: string;
}

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

  try {
    const result = await apiRequest<ParentRegistrationResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(validatedFields.data),
    });

    if (!result.data?.user) return { success: false, message: 'Respons registrasi parent tidak lengkap.' };

    return {
      success: true,
      message: 'Parent account berhasil dibuat. Silakan masuk.',
      redirectTo: '/login',
    };
  } catch (error) {
    if (error instanceof ApiError) return { success: false, message: error.message };
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

  try {
    const result = await apiRequest<TenantRegistrationResponse>('/api/v1/tenants/register', {
      method: 'POST',
      body: JSON.stringify(validatedFields.data),
    });

    if (result.data?.token && result.data.tenant?.id) {
      const cookieStore = await cookies();
      cookieStore.set(getAuthCookieName(), result.data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      cookieStore.set(getTenantCookieName(), result.data.tenant.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
    } else {
      return { success: false, message: 'Respons registrasi tenant tidak lengkap.' };
    }

    return {
      success: true,
      message: 'Tenant account registered successfully.',
      redirectTo: '/dashboard/tenant',
    };
  } catch (error) {
    if (error instanceof ApiError) return { success: false, message: error.message };
    console.error('[registerTenant Error]:', error);
    return {
      success: false,
      message: 'An unexpected connection error occurred. Please try again later.',
    };
  }
}
