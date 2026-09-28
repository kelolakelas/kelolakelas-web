import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeListEnvelope } from '@/lib/list-envelope';
import { normalizeScheduleRequests, type ScheduleRequest } from '@/lib/schedule-request';
import { normalizeStudentList, type Student } from '@/lib/students';
import { classesById, scheduleRequestQueryString, type ScheduleRequestClassLike, type ScheduleRequestFilters } from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * One tenant schedule request together with the labels this screen can show.
 *
 * The class name is always resolved from the tenant's own class list. The
 * student is best-effort: a request-only student has no enrollment yet, and
 * the tenant-scoped student lookup answers 404 for rows the caller may not
 * read, so a missing student degrades to the neutral placeholder rendered by
 * `scheduleRequestStudentName` instead of failing the page.
 */
export interface TenantScheduleRequestRow {
  request: ScheduleRequest;
  className: string | null;
  student: Student | null;
}

export interface TenantScheduleRequestOverview {
  rows: TenantScheduleRequestRow[];
  total: number;
}

/**
 * Result of reading the tenant schedule-request work queue.
 *
 * `forbidden` is a first-class state rather than an error page: the academic
 * service guards `GET /api/v1/schedule-requests` with `enrollment:read` (parent
 * tokens skipped), so a member without that permission is expected to land
 * here and must be told so without being shown a technical failure.
 */
export type TenantScheduleRequestResult =
  | { data: TenantScheduleRequestOverview; error: null }
  | { data: null; error: 'invalid_filter' }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string };

const FORBIDDEN_MESSAGE =
  'Anda tidak memiliki izin melihat permintaan jadwal tenant ini. Hubungi administrator tenant untuk mendapatkan permission enrollment:read.';

const API_ERROR_MESSAGE = 'Daftar permintaan jadwal belum dapat dimuat. Coba muat ulang beberapa saat lagi.';

const CONFIGURATION_FALLBACK_MESSAGE =
  'Layanan permintaan jadwal sedang tidak tersedia. Coba lagi nanti.';

/**
 * Extracts authorization and tenant headers from server cookies.
 *
 * The tenant is resolved from the session server-side. A tenant identifier
 * sent by the browser is never treated as an authorization source: the API
 * gateway strips client-supplied context headers and the downstream services
 * derive the tenant from the JWT claim only.
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

type ClassEntityLike = ScheduleRequestClassLike;

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/**
 * Reads the caller-scoped schedule-request list for one filter state.
 *
 * The backend scopes rows to the caller, so nothing on this page filters by
 * tenant in the browser. The repository serves at most 100 rows newest first
 * with no page parameters; the only filter this screen can change is the
 * request status the backend has already validated.
 */
export async function getTenantScheduleRequests(
  input: Record<string, string | string[] | undefined>,
  filters: ScheduleRequestFilters
): Promise<TenantScheduleRequestResult> {
  void input;

  try {
    const headers = await getAuthHeaders();
    const query = scheduleRequestQueryString(filters);
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/schedule-requests${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (response.status === 401 || response.status === 403) {
      return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    }

    const body = await readJson(response);

    if (!response.ok || !body || typeof body !== 'object' || (body as { status?: unknown }).status !== 'success') {
      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }

    const requests = normalizeScheduleRequests(normalizeListEnvelope((body as { data?: unknown }).data).items);
    const rows = await attachLabels(headers, requests);

    return { data: { rows, total: rows.length }, error: null };
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message: getGatewayConfigurationErrorMessage(error) ?? CONFIGURATION_FALLBACK_MESSAGE,
    };
  }
}

/**
 * Labels every request with its class name and, best-effort, its student.
 *
 * The class list is the only name source for classes: the request rows carry
 * only `class_id`. Losing it still shows the rows under a neutral label. The
 * student lookup runs per distinct `student_id` with `GET /api/v1/students/:id`
 * and a lookup that fails for a single row is treated as "no student to show"
 * instead of failing the page.
 */
async function attachLabels(headers: HeadersInit, requests: ScheduleRequest[]): Promise<TenantScheduleRequestRow[]> {
  if (requests.length === 0) {
    return [];
  }

  const classIndex = await loadClassIndex(headers);
  const studentIndex = await loadStudentIndex(headers, requests);

  return requests.map((request) => ({
    request,
    className: classIndex.get(request.class_id)?.name ?? null,
    student: studentIndex.get(request.student_id) ?? null,
  }));
}

async function loadClassIndex(headers: HeadersInit): Promise<Map<string, ClassEntityLike>> {
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/classes?page=1&page_size=100`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    const body = await readJson(response);

    if (!response.ok || !body || typeof body !== 'object' || (body as { status?: unknown }).status !== 'success') {
      return new Map();
    }

    return classesById(normalizeListEnvelope<ClassEntityLike>((body as { data?: unknown }).data).items);
  } catch {
    return new Map();
  }
}

/** Loads one student per distinct request `student_id`; failures stay absent. */
async function loadStudentIndex(
  headers: HeadersInit,
  requests: ScheduleRequest[]
): Promise<Map<string, Student>> {
  const ids = [...new Set(requests.map((request) => request.student_id))];
  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, Student] | null> => {
      try {
        const response = await fetch(`${getGatewayBaseUrl()}/api/v1/students/${encodeURIComponent(id)}`, {
          method: 'GET',
          headers,
          cache: 'no-store',
        });
        const body = await readJson(response);

        if (
          !response.ok ||
          !body ||
          typeof body !== 'object' ||
          (body as { status?: unknown }).status !== 'success'
        ) {
          return null;
        }

        const student = normalizeStudentList({ items: [(body as { data?: unknown }).data] }).items[0];

        return student ? [id, student] : null;
      } catch {
        return null;
      }
    })
  );

  const index = new Map<string, Student>();

  for (const entry of entries) {
    if (entry) {
      index.set(entry[0], entry[1]);
    }
  }

  return index;
}
