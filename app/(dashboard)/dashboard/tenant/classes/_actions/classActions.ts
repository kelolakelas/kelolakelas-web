'use server';

import { classCreationSchema, type ClassCreationInput, type ClassCreationResult } from '../_lib/class-creation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { classUpdateErrorMessage } from '@/lib/class-edit';
import { normalizeListEnvelope } from '@/lib/list-envelope';
import { memberSchema } from '../../members/_schemas/schema';
import type { ScheduleTeacher, ScheduleTeachersRead } from '../_lib/teachers';

/** Read every member page; never offer a partial list as the complete teacher list. */
export async function getScheduleTeachers(): Promise<ScheduleTeachersRead> {
  try {
    const headers = await getAuthHeaders();
    const teachers: ScheduleTeacher[] = [];
    for (let page = 1; ; page++) {
      const response = await fetch(`${getGatewayBaseUrl()}/api/v1/members?page=${page}&page_size=100`, {
        headers, cache: 'no-store',
      });
      if (response.status === 403) return { state: 'forbidden' };
      if (!response.ok) return { state: 'error' };
      const result = await response.json();
      if (result.status !== 'success' || (!Array.isArray(result.data) && !Array.isArray(result.data?.items))) {
        return { state: 'error' };
      }
      const normalized = normalizeListEnvelope<unknown>(result.data);
      for (const raw of normalized.items) {
        const parsed = memberSchema.safeParse(raw);
        if (!parsed.success) return { state: 'error' };
        const member = parsed.data;
        if (member.status === 'active' && member.role?.name === 'Teacher') {
          teachers.push({ id: member.id, name: `${member.first_name} ${member.last_name}`.trim() || member.email });
        }
      }
      if (page >= normalized.pagination.total_pages) break;
      if (page >= 1000 || normalized.items.length === 0) return { state: 'error' };
    }
    return { state: 'ok', teachers };
  } catch {
    return { state: 'error' };
  }
}
import {
  createCategorySchema,
  categoryIdSchema,
  updateCategorySchema,
  createClassSchema,
  createScheduleSchema,
  updateClassPublicationSchema,
  updateClassSchema,
  type ClassEntity,
  type ClassSchedule,
  type CreateScheduleInput,
} from '../_lib/schema';

export async function assignScheduleTeacher(scheduleId: string, teacherId: string, effectiveDate: string): Promise<ActionResponse> {
  if (!categoryIdSchema.safeParse(scheduleId).success || !categoryIdSchema.safeParse(teacherId).success ||
      !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || !Number.isFinite(Date.parse(`${effectiveDate}T00:00:00Z`))) {
    return { success: false, message: 'Jadwal, teacher, atau tanggal tidak valid.' };
  }
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/schedules/tutor-permanent`, {
      method: 'PATCH', headers: await getAuthHeaders(), cache: 'no-store',
      body: JSON.stringify({ schedule_id: scheduleId, new_tutor_id: teacherId, effective_date: `${effectiveDate}T00:00:00Z` }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== 'success') {
      const messages: Record<number, string> = {
        400: 'Teacher tidak aktif atau tanggal di luar masa berlaku jadwal.',
        401: 'Sesi berakhir. Silakan masuk kembali.',
        403: 'Anda tidak memiliki izin untuk menugaskan teacher.',
        404: 'Jadwal tidak tersedia. Muat ulang halaman.',
        503: 'Membership atau izin belum dapat diverifikasi. Coba kembali nanti.',
      };
      return { success: false, message: messages[response.status] || 'Penugasan belum berhasil. Coba kembali.' };
    }
    revalidatePath('/dashboard/tenant/classes');
    revalidatePath('/dashboard/tenant/sessions');
    return { success: true, message: 'Teacher berhasil ditugaskan.' };
  } catch {
    return { success: false, message: 'Server tidak dapat dihubungi. Coba kembali.' };
  }
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: T;
  retrySameRequest?: boolean;
}

export async function updateCategory(categoryId: string, formData: FormData): Promise<ActionResponse> {
  const validation = updateCategorySchema.safeParse({
    name: formData.get('name'),
    description: formData.has('description') ? formData.get('description') : undefined,
  });
  if (!validation.success) {
    return { success: false, message: 'Please correct the category fields.', errors: validation.error.flatten().fieldErrors };
  }
  return mutateCategory(categoryId, 'PATCH', validation.data);
}

export async function deleteCategory(categoryId: string): Promise<ActionResponse> {
  return mutateCategory(categoryId, 'DELETE');
}

async function mutateCategory(categoryId: string, method: 'PATCH' | 'DELETE', body?: { name: string; description?: string }): Promise<ActionResponse> {
  if (!categoryIdSchema.safeParse(categoryId).success) {
    return { success: false, message: 'Invalid category identifier. Refresh the list.' };
  }
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/categories/${categoryId}`, {
      method, headers: await getAuthHeaders(), cache: 'no-store',
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== 'success') {
      const messages: Record<number, string> = {
        401: 'Your session has expired. Please sign in again.',
        403: `You do not have permission to ${method === 'PATCH' ? 'update' : 'delete'} categories. Ask a tenant administrator.`,
        404: 'This category is unavailable. Refresh the list.',
        409: 'This category has active classes and cannot be deleted. Your input has been kept.',
        422: 'Category name is required. Please check your input.',
        503: 'Your permission could not be verified. Please try again shortly.',
      };
      return { success: false, message: messages[response.status] || 'Unable to save category changes. Please try again.' };
    }
    revalidatePath('/dashboard/tenant/classes');
    return { success: true, message: method === 'PATCH' ? 'Category renamed.' : 'Category deleted.' };
  } catch (error) {
    return { success: false, message: getGatewayConfigurationErrorMessage(error) || 'Unable to reach the server. Please try again.' };
  }
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
  formData: FormData,
): Promise<ActionResponse<ClassEntity>> {
  const newCategory = formData.get('new_category') === 'true';
  let category: { name: string; description?: string } | undefined;
  if (newCategory) {
    const parsed = createCategorySchema.safeParse({
      name: formData.get('category_name'),
      description: formData.get('category_description') || undefined,
    });
    if (!parsed.success)
      return {
        success: false,
        message: 'Check the new category fields.',
        errors: { category_id: [parsed.error.issues[0].message] },
      };
    category = parsed.data;
  }
  let teacherIds: unknown;
  if (formData.has('teacher_ids')) {
    try {
      teacherIds = JSON.parse(String(formData.get('teacher_ids')));
    } catch {
      return { success: false, message: 'Invalid teacher assignments.' };
    }
  }
  const validation = updateClassSchema.safeParse({
    ...(formData.has('is_published')
      ? { is_published: formData.get('is_published') === 'true' }
      : {}),
    ...(formData.has('enrollment_status')
      ? { enrollment_status: formData.get('enrollment_status') }
      : {}),
    ...(teacherIds !== undefined ? { teacher_ids: teacherIds } : {}),
    class_id: formData.get('class_id')?.toString() || '',
    category_id: newCategory
      ? 'draft-category'
      : formData.get('category_id')?.toString() || '',
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

  const { class_id: classId, category_id, ...details } = validation.data;
  const payload = category
    ? { ...details, category }
    : { ...details, category_id };

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
      },
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.status !== 'success') {
      return {
        success: false,
        message: classUpdateErrorMessage(
          response.status,
          typeof result.message === 'string' ? result.message : undefined,
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

/** Final wizard mutation. The gateway/backend remain the authorization authority. */
export async function createClassConfiguration(
  input: ClassCreationInput,
  key: string,
): Promise<ActionResponse<ClassCreationResult>> {
  const parsed = classCreationSchema.safeParse(input);
  if (!parsed.success || !/^[a-zA-Z0-9-]{1,128}$/.test(key))
    return {
      success: false,
      message: 'Check the category, class, teachers and schedule fields.',
    };
  try {
    const auth = await getAuthHeaders();
    if (!(auth as Record<string, string>).Authorization)
      return {
        success: false,
        message: 'Your session has expired. Please sign in again.',
      };
    const payload = {
      ...parsed.data,
      schedules: parsed.data.schedules.map((slot) => ({
        ...slot,
        start_time:
          slot.start_time.length === 5
            ? `${slot.start_time}:00`
            : slot.start_time,
        end_time:
          slot.end_time.length === 5 ? `${slot.end_time}:00` : slot.end_time,
      })),
    };
    const response = await fetch(
      `${getGatewayBaseUrl()}/api/v1/classes/with-category`,
      {
        method: 'POST',
        headers: { ...auth, 'Idempotency-Key': key },
        body: JSON.stringify(payload),
        cache: 'no-store',
      },
    );
    const result = await response.json().catch(() => null);
    if (
      !response.ok ||
      result?.status !== 'success' ||
      typeof result.data?.class?.id !== 'string' ||
      typeof result.data?.class?.name !== 'string'
    ) {
      const messages: Record<number, string> = {
        401: 'Your session has expired. Please sign in again.',
        403: 'You do not have permission to save this class configuration.',
        409: 'This retry key belongs to a different request. Reopen the class list to check the saved class.',
      };
      return {
        success: false,
        message:
          messages[response.status] ||
          (response.status === 400 && typeof result?.message === 'string' ? result.message : null) ||
          'Class setup could not be confirmed. Retry the same request to check its result.',
        retrySameRequest:
          response.status >= 500 || response.ok || response.status === 409,
      };
    }
    revalidatePath('/dashboard/tenant/classes');
    revalidatePath('/dashboard/tenant/sessions');
    return {
      success: true,
      message: `Class "${result.data.class.name}" saved with its complete configuration.`,
      data: result.data,
    };
  } catch {
    return {
      success: false,
      message:
        'Class setup could not be confirmed. Retry the same request to check its result.',
      retrySameRequest: true,
    };
  }
}

/** Re-read every page after an editor operation; an unavailable read is never an empty-success. */
export async function readClassConfiguration(
  classId: string,
): Promise<
  ActionResponse<{
    class: ClassEntity;
    schedules: ClassSchedule[];
    categories: import('../_lib/schema').Category[];
  }>
> {
  if (!categoryIdSchema.safeParse(classId).success)
    return { success: false, message: 'Invalid class.' };
  try {
    const headers = await getAuthHeaders();
    const read = async <T>(resource: string) => {
      const items: T[] = [];
      for (let page = 1; page <= 1000; page++) {
        const response = await fetch(
          `${getGatewayBaseUrl()}/api/v1/${resource}?page=${page}&page_size=100`,
          { headers, cache: 'no-store' },
        );
        const result = await response.json();
        if (
          !response.ok ||
          result.status !== 'success' ||
          (!Array.isArray(result.data) && !Array.isArray(result.data?.items))
        )
          throw new Error('read failed');
        const normalized = normalizeListEnvelope<T>(result.data);
        items.push(...normalized.items);
        if (page >= normalized.pagination.total_pages) return items;
        if (normalized.items.length === 0) throw new Error('incomplete read');
      }
      throw new Error('incomplete read');
    };
    const [classes, schedules, categories] = await Promise.all([
      read<ClassEntity>('classes'),
      read<ClassSchedule>('schedules'),
      read<import('../_lib/schema').Category>('categories'),
    ]);
    const record = classes.find((item) => item.id === classId);
    if (!record)
      return {
        success: false,
        message: 'Class is no longer available. Refresh the class list.',
      };
    return {
      success: true,
      message: 'Saved configuration reloaded.',
      data: {
        class: record,
        schedules: schedules.filter((item) => item.class_id === classId),
        categories,
      },
    };
  } catch {
    return {
      success: false,
      message:
        'The saved configuration could not be reloaded. Close and reopen to check it before another change.',
    };
  }
}

export async function changeClassSchedule(
  scheduleId: string,
  input: import('../_lib/schema').ScheduleItemInput,
  effectiveDate: string,
): Promise<ActionResponse> {
  const validation = createScheduleSchema.safeParse({
    class_id: scheduleId,
    schedules: [input],
  });
  if (
    !categoryIdSchema.safeParse(scheduleId).success ||
    !validation.success ||
    !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ||
    !Number.isFinite(Date.parse(`${effectiveDate}T00:00:00Z`))
  )
    return {
      success: false,
      message: 'Check the schedule fields and effective date.',
    };
  const slot = validation.data.schedules[0];
  return mutateEditorSchedule('PUT', '/api/v1/schedules/permanent', {
    old_schedule_id: scheduleId,
    new_day_of_week: slot.day_of_week,
    new_start_time: slot.start_time,
    new_end_time: slot.end_time,
    new_capacity: slot.capacity,
    new_location: slot.location ?? '',
    new_tutor_id: slot.tutor_id ?? '00000000-0000-0000-0000-000000000000',
    effective_date: `${effectiveDate}T00:00:00Z`,
  });
}
export async function deleteClassSchedule(
  scheduleId: string,
): Promise<ActionResponse> {
  if (!categoryIdSchema.safeParse(scheduleId).success)
    return { success: false, message: 'Invalid schedule.' };
  return mutateEditorSchedule('DELETE', `/api/v1/schedules/${scheduleId}`);
}
async function mutateEditorSchedule(
  method: string,
  path: string,
  payload?: unknown,
): Promise<ActionResponse> {
  try {
    const response = await fetch(`${getGatewayBaseUrl()}${path}`, {
      method,
      headers: await getAuthHeaders(),
      cache: 'no-store',
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.status !== 'success')
      return {
        success: false,
        message:
          response.status === 403
            ? 'You do not have permission for this schedule operation.'
            : typeof result?.message === 'string'
              ? result.message
              : 'The operation could not be confirmed. Reload the saved configuration before trying again.',
      };
    revalidatePath('/dashboard/tenant/classes');
    revalidatePath('/dashboard/tenant/sessions');
    return { success: true, message: 'Schedule operation saved.' };
  } catch {
    return {
      success: false,
      message:
        'The operation could not be confirmed. Reload the saved configuration before trying again.',
    };
  }
}
