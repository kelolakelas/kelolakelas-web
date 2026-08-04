'use server';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { revalidatePath } from 'next/cache';
import { buildClassSetupPayload } from '../_lib/classSetup';
import {
    createCategorySchema,
    createClassSchema,
    createScheduleSchema,
    type ClassSetupResponse,
    type CreateScheduleInput,
} from '../_lib/schema';

export interface ActionResponse<T = unknown> {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: T;
}

function getActionError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function getDeleteError(error: unknown, resource: 'category' | 'class' | 'schedule'): string {
  if (!(error instanceof ApiError)) {
    return `${resource === 'category' ? 'Kategori' : resource === 'class' ? 'Kelas' : 'Jadwal'} gagal dihapus. Silakan coba lagi.`;
  }

  if (error.status === 409 && resource === 'category') {
    return 'Kategori masih memiliki class aktif dan tidak dapat dihapus.';
  }
  if (error.status === 409 && resource === 'class') {
    return 'Class masih memiliki enrollment aktif dan tidak dapat dihapus.';
  }
  return error.message;
}

async function deleteResource(
  formData: FormData,
  resource: 'category' | 'class' | 'schedule',
  path: string,
  successMessage: string
): Promise<ActionResponse> {
  const id = formData.get('id')?.toString().trim();
  if (!id) return { success: false, message: 'Data yang akan dihapus tidak ditemukan.' };

  try {
    await apiRequest(`${path}/${id}`, { method: 'DELETE' });
    revalidatePath('/dashboard/tenant/classes');
    return { success: true, message: successMessage };
  } catch (error) {
    console.error(`[delete${resource} Action Error]:`, error);
    return { success: false, message: getDeleteError(error, resource) };
  }
}

export async function deleteCategory(_prevState: ActionResponse, formData: FormData): Promise<ActionResponse> {
  return deleteResource(formData, 'category', '/api/v1/categories', 'Category berhasil dihapus.');
}

export async function deleteClass(_prevState: ActionResponse, formData: FormData): Promise<ActionResponse> {
  return deleteResource(formData, 'class', '/api/v1/classes', 'Class berhasil dinonaktifkan.');
}

export async function deleteSchedule(_prevState: ActionResponse, formData: FormData): Promise<ActionResponse> {
  return deleteResource(formData, 'schedule', '/api/v1/schedules', 'Schedule berhasil dinonaktifkan.');
}

function parseSetupValue<T>(formData: FormData, field: string, fallback?: T): T {
  const value = formData.get(field)?.toString();
  if (!value) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${field} is required`);
  }
  return JSON.parse(value) as T;
}

/**
 * Commits the complete wizard payload after all three steps have been reviewed.
 * The backend owns the transaction across category, class, schedules, and sessions.
 */
export async function createClassSetup(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  try {
    const result = buildClassSetupPayload({
      category: parseSetupValue(formData, 'category'),
      class: parseSetupValue(formData, 'class'),
      teacher_ids: parseSetupValue(formData, 'teacher_ids', []),
      schedules: parseSetupValue(formData, 'schedules', []),
    });
    if (!result.success) return result;

    const response = await apiRequest<ClassSetupResponse>('/api/v1/classes/with-category', {
      method: 'POST',
      body: JSON.stringify(result.payload),
    });

    revalidatePath('/dashboard/tenant/classes');
    return { success: true, message: 'Class setup completed successfully.', data: response.data };
  } catch (error) {
    console.error('[createClassSetup Action Error]:', error);
    return {
      success: false,
      message: getActionError(error, 'Class setup gagal disimpan. Silakan coba lagi.'),
    };
  }
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
    const result = await apiRequest('/api/v1/categories', {
      method: 'POST',
      body: JSON.stringify(validation.data),
    });

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
      message: getActionError(error, 'Kategori gagal dibuat. Silakan coba lagi.'),
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
    const result = await apiRequest('/api/v1/classes', {
      method: 'POST',
      body: JSON.stringify(validation.data),
    });

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
      message: getActionError(error, 'Kelas gagal dibuat. Silakan coba lagi.'),
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
    const result = await apiRequest('/api/v1/schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

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
      message: getActionError(error, 'Jadwal gagal disimpan. Silakan coba lagi.'),
    };
  }
}
