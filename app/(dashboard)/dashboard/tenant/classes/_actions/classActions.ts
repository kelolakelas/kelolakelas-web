'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { classUpdateErrorMessage } from '@/lib/class-edit';
import {
  createCategorySchema,
  createClassSchema,
  createScheduleSchema,
  updateClassPublicationSchema,
  updateClassSchema,
  type ClassEntity,
  type CreateScheduleInput,
} from '../_lib/schema';

export interface ActionResponse<T = unknown> {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: T;
}

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * Extracts authorization and tenant headers from server cookies.
 *
 * The tenant is resolved from the session server-side; a tenant identifier
 * supplied by the browser is never used as an authorization source.
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
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/categories`, {
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
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network or server error occurred. Please try again.',
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
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/classes`, {
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
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network or server error occurred. Please try again.',
    };
  }
}

/**
 * Maps a failed schedule creation onto a message the member can act on.
 *
 * `POST /api/v1/schedules` is guarded by the `schedule:create` permission, so
 * a member without it always receives `403 Permission denied`. A `404` covers
 * both a class that was deleted by another member while the form was open and
 * a private-class enrollment that no longer exists, because the usecase maps
 * both onto `ErrClassNotFound`/`ErrEnrollmentNotFound`. A `400` is only ever
 * reached with schema-invalid data (the dashboard validates first), so the
 * backend message names the exact rejected field and is shown verbatim.
 */
function createScheduleErrorMessage(
  status: number,
  backendMessage: string | undefined
): string {
  if (status === 401) {
    return 'Your session has expired. Please sign in again to save the schedules.';
  }

  if (status === 403) {
    return 'You do not have permission to create schedules. Ask a tenant administrator for the schedule:create permission.';
  }

  if (status === 404) {
    return 'This class or its enrollment no longer exists. Close this form and refresh the list.';
  }

  if (status === 503) {
    return 'The authorization service is unavailable, so your permission could not be verified. Please try again shortly.';
  }

  if (backendMessage) {
    return backendMessage;
  }

  return 'Failed to create class schedules. Please check your timetable inputs.';
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
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/schedules`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message: createScheduleErrorMessage(
          response.status,
          typeof result.message === 'string' ? result.message : undefined
        ),
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
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network error occurred while saving schedules.',
    };
  }
}

/**
 * Maps a failed publication response onto a message the tenant can act on.
 *
 * The academic service guards this endpoint with the `class:update` permission,
 * so a member without it always receives `403 Permission denied`.
 */
function publicationErrorMessage(
  status: number,
  backendMessage: string | undefined,
  isPublishing: boolean
): string {
  if (status === 401) {
    return 'Your session has expired. Please sign in again to change the publication status.';
  }

  if (status === 403) {
    return 'You do not have permission to publish or unpublish classes. Ask a tenant administrator for the class:update permission.';
  }

  if (status === 404) {
    return 'This class no longer exists. Refresh the page to see the current list.';
  }

  if (status === 503) {
    return 'The authorization service is unavailable, so the publication status could not be verified. Please try again shortly.';
  }

  if (backendMessage) {
    return backendMessage;
  }

  return isPublishing
    ? 'Failed to publish the class. Please try again.'
    : 'Failed to unpublish the class. Please try again.';
}

/**
 * Server Action: Publish or unpublish a class.
 * Endpoint: PATCH /api/v1/classes/:id/published
 *
 * The `class:update` permission is required. The gateway and the academic
 * service both derive the tenant from the session, so the class identifier is
 * the only value taken from the caller.
 */
export async function updateClassPublication(
  _prevState: ActionResponse,
  formData: FormData
): Promise<ActionResponse> {
  // Only the exact strings "true" and "false" are accepted. Anything else fails
  // validation so a malformed submission can never silently unpublish a class.
  const rawPublished = formData.get('is_published')?.toString();
  const requestedState =
    rawPublished === 'true' ? true : rawPublished === 'false' ? false : undefined;

  const validation = updateClassPublicationSchema.safeParse({
    class_id: formData.get('class_id')?.toString() || '',
    is_published: requestedState,
  });

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed for the publication request.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { class_id: classId, is_published: isPublished } = validation.data;

  try {
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${baseUrl}/api/v1/classes/${encodeURIComponent(classId)}/published`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_published: isPublished }),
        cache: 'no-store',
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message: publicationErrorMessage(
          response.status,
          typeof result.message === 'string' ? result.message : undefined,
          isPublished
        ),
      };
    }

    revalidatePath('/dashboard/tenant/classes');

    return {
      success: true,
      message: isPublished
        ? 'Class published. It is now visible in /kelas.'
        : 'Class unpublished. It is no longer visible in /kelas.',
      data: result.data,
    };
  } catch (error) {
    console.error('[updateClassPublication Action Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network error occurred while updating the publication status.',
    };
  }
}

/**
 * Server Action: Update the sellable attributes of an existing class.
 * Endpoint: PATCH /api/v1/classes/:id
 *
 * Only the four editable attributes are submitted. Class type is never sent
 * because the academic service rejects a type change, and the update endpoint
 * treats an omitted field as "leave unchanged", so the form always submits the
 * complete editable set it just validated. The tenant comes from the session
 * server-side; the class identifier is the only value taken from the browser.
 */
export async function updateClass(
  _prevState: ActionResponse<ClassEntity>,
  formData: FormData
): Promise<ActionResponse<ClassEntity>> {
  const validation = updateClassSchema.safeParse({
    class_id: formData.get('class_id')?.toString() || '',
    category_id: formData.get('category_id')?.toString() || '',
    name: formData.get('name')?.toString() || '',
    // The price field keeps the tenant's raw typing so `Rp 150.000` is
    // normalised by the schema instead of being coerced here and lost.
    price: formData.get('price')?.toString() ?? '',
    // A blank description is sent as an empty string rather than dropped. The
    // update endpoint skips a field that is absent, so dropping it would make
    // clearing a description a silent no-op. Verified against the endpoint: an
    // empty string is stored, and the public catalog renders it as no
    // description (`descriptionText` maps a blank value to null).
    description: formData.get('description')?.toString() ?? '',
  });

  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { class_id: classId, ...payload } = validation.data;

  try {
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${baseUrl}/api/v1/classes/${encodeURIComponent(classId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message: classUpdateErrorMessage(
          response.status,
          typeof result.message === 'string' ? result.message : undefined
        ),
      };
    }

    revalidatePath('/dashboard/tenant/classes');

    return {
      success: true,
      message: `Class "${payload.name}" updated successfully.`,
      data: result.data as ClassEntity,
    };
  } catch (error) {
    console.error('[updateClass Action Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network or server error occurred. Please try again.',
    };
  }
}
