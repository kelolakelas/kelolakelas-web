'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  createCategorySchema,
  createClassSchema,
  createScheduleSchema,
  type CreateScheduleInput,
} from '../_lib/schema';

export interface ActionResponse<T = unknown> {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: T;
}

const DEFAULT_API_URL = 'http://localhost:3000';
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
 * Helper to ensure standard API URL endpoint.
 */
function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
}

/**
 * Server Action: Create a new academic subject/course category.
 * Endpoint: POST /api/v1/categories
 */
export async function createCategory(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    name: formData.get('name')?.toString() || '',
    description: formData.get('description')?.toString() || undefined,
  };

  const validation = createCategorySchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${getApiBaseUrl()}/api/v1/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify(validation.data),
      cache: 'no-store',
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message:
          result.message ||
          'Failed to create category. Please verify your inputs and try again.',
      };
    }

    revalidatePath('/dashboard/tenant/classes');

    return {
      success: true,
      message: `Category "${validation.data.name}" created successfully.`,
      data: result.data,
    };
  } catch (error) {
    console.error('[createCategory Action Error]:', error);
    return {
      success: false,
      message: 'An unexpected network or server error occurred. Please try again.',
    };
  }
}

/**
 * Server Action: Create a new academic class within a category.
 * Endpoint: POST /api/v1/classes
 */
export async function createClass(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  const rawData = {
    category_id: formData.get('category_id')?.toString() || '',
    name: formData.get('name')?.toString() || '',
    type: formData.get('type')?.toString() || 'group',
    price: formData.get('price') ? Number(formData.get('price')) : 0,
    capacity: formData.get('capacity') ? Number(formData.get('capacity')) : undefined,
    description: formData.get('description')?.toString() || undefined,
  };

  const validation = createClassSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed. Please check form fields.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${getApiBaseUrl()}/api/v1/classes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(validation.data),
      cache: 'no-store',
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message:
          result.message ||
          'Failed to create class. Please verify inputs and try again.',
      };
    }

    revalidatePath('/dashboard/tenant/classes');

    return {
      success: true,
      message: `Class "${validation.data.name}" created successfully.`,
      data: result.data,
    };
  } catch (error) {
    console.error('[createClass Action Error]:', error);
    return {
      success: false,
      message: 'An unexpected network or server error occurred. Please try again.',
    };
  }
}

/**
 * Server Action: Create initial recurring schedule slots for a class.
 * Endpoint: POST /api/v1/schedules
 */
export async function createSchedule(
  _prevState: ActionResponse,
  input: FormData | CreateScheduleInput
): Promise<ActionResponse> {
  let rawData: unknown;

  if (input instanceof FormData) {
    const classId = input.get('class_id')?.toString() || '';
    const rawSchedulesJson = input.get('schedules')?.toString() || '[]';
    try {
      rawData = {
        class_id: classId,
        schedules: JSON.parse(rawSchedulesJson),
      };
    } catch {
      return {
        success: false,
        message: 'Invalid schedule JSON format received.',
      };
    }
  } else {
    rawData = input;
  }

  const validation = createScheduleSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed for schedule entries.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  // Format times to ensure HH:MM:SS format before sending to backend
  const payload = {
    class_id: validation.data.class_id,
    schedules: validation.data.schedules.map((item) => ({
      ...item,
      start_time:
        item.start_time.split(':').length === 2
          ? `${item.start_time}:00`
          : item.start_time,
      end_time:
        item.end_time.split(':').length === 2 ? `${item.end_time}:00` : item.end_time,
    })),
  };

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${getApiBaseUrl()}/api/v1/schedules`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message:
          result.message ||
          'Failed to create class schedules. Please check your timetable inputs.',
      };
    }

    revalidatePath('/dashboard/tenant/classes');

    return {
      success: true,
      message: 'Class schedule set up successfully!',
      data: result.data,
    };
  } catch (error) {
    console.error('[createSchedule Action Error]:', error);
    return {
      success: false,
      message: 'An unexpected network error occurred while saving schedules.',
    };
  }
}
