import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeListEnvelope, type ListPagination } from '@/lib/list-envelope';
import {
  attendanceByEnrollment,
  isSessionUuid,
  normalizeSessionAttendance,
  normalizeSessionAttendees,
  parseSessionFilters,
  sessionAttendanceQueryString,
  sessionDateRange,
  sessionQueryString,
  type SessionAttendee,
  type SessionAttendanceRecord,
  type SessionFilters,
  type TutorSession,
} from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/** One session together with its attendees and their read-back attendance. */
export interface TutorSessionRow {
  session: TutorSession;
  attendees: SessionAttendee[];
  attendance: Map<string, SessionAttendanceRecord>;
  /**
   * True when the attendance read-back was refused with `403` (KEL-137): the
   * member lacks `attendance:read`, so the saved states are unknown to them
   * rather than absent. They must not be rendered as "not yet recorded".
   */
  attendanceForbidden?: boolean;
}

export interface TutorSessionOverview {
  rows: TutorSessionRow[];
  pagination: ListPagination;
  /** Classes of the tenant, used to label the class filter options. */
  classes: { id: string; name: string }[];
}

/**
 * Result of reading the tutor session overview.
 *
 * `forbidden` is a first-class state rather than an error page: since
 * KEL-135 the academic service guards `GET /api/v1/sessions` with
 * `schedule:read`, so a tenant member without that permission is expected to
 * land here and must be told so without being shown a technical failure.
 */
export type TutorSessionResult =
  | { data: TutorSessionOverview; error: null }
  | { data: null; error: 'invalid_filter' }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string };

const FORBIDDEN_MESSAGE =
  'Anda tidak memiliki izin melihat sesi tenant ini. Hubungi administrator tenant untuk mendapatkan permission schedule:read.';

const API_ERROR_MESSAGE = 'Daftar sesi belum dapat dimuat. Coba muat ulang beberapa saat lagi.';

const CONFIGURATION_FALLBACK_MESSAGE =
  'Layanan sesi sedang tidak tersedia. Coba lagi nanti.';

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

interface SessionRead {
  status: number;
  ok: boolean;
  items: TutorSession[];
  pagination: ListPagination;
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/** Whether a body is a success envelope carrying usable data. */
function isSuccessEnvelope(body: unknown): body is { status: string; data?: unknown } {
  return (
    Boolean(body) &&
    typeof body === 'object' &&
    (body as { status?: unknown }).status === 'success'
  );
}

/**
 * Reads the tutor's own sessions for one filter state.
 *
 * `mine=true` is always sent so the list holds only sessions where the caller
 * is the tutor: the academic service derives the tutor from the verified JWT
 * member claim (KEL-135). Both `scheduled` and `rescheduled` rows are kept —
 * the original row and its replacement are both visible, which is how the
 * acceptance criterion "termasuk sesi reschedule" is met.
 */
async function readSessions(
  filters: SessionFilters,
  headers: HeadersInit
): Promise<SessionRead> {
  const range = sessionDateRange(filters);
  const response = await fetch(
    `${getGatewayBaseUrl()}/api/v1/sessions?${sessionQueryString(filters, range)}`,
    { method: 'GET', headers, cache: 'no-store' }
  );

  const body = await readJson(response);
  const envelope = normalizeListEnvelope<TutorSession>(
    isSuccessEnvelope(body) ? body.data : null
  );

  const succeeded = response.ok && isSuccessEnvelope(body);

  return {
    status: response.status,
    ok: succeeded,
    items: succeeded ? envelope.items : [],
    pagination: envelope.pagination,
  };
}

/**
 * Reads the attendees of one session.
 *
 * The endpoint answers a bare enrollment array with the student preloaded. A
 * failed read degrades to "no attendees to show" instead of failing the
 * page: the session list is the primary content, and the attendance form
 * renders its own empty state per session.
 */
async function readAttendees(
  headers: HeadersInit,
  sessionId: string
): Promise<SessionAttendee[]> {
  try {
    const response = await fetch(
      `${getGatewayBaseUrl()}/api/v1/sessions/${encodeURIComponent(sessionId)}/attendees`,
      { method: 'GET', headers, cache: 'no-store' }
    );

    const body = await readJson(response);

    if (!response.ok || !isSuccessEnvelope(body)) {
      return [];
    }

    // The endpoint answers a bare enrollment array, not the paginated
    // envelope; `normalizeListEnvelope` accepts both shapes.
    return normalizeSessionAttendees(normalizeListEnvelope(body.data).items);
  } catch {
    return [];
  }
}

interface AttendanceRead {
  records: SessionAttendanceRecord[];
  forbidden: boolean;
}

/**
 * Reads the saved attendance of one enrollment.
 *
 * The list endpoint understands no `session_id` filter, so the rows of one
 * enrollment are read and the caller matches them to the saved session
 * itself. A `403` is recorded as a permission state; every other failure
 * still degrades to "no attendance to show" so one unreadable enrollment
 * cannot hide the whole session.
 */
async function readEnrollmentAttendance(
  headers: HeadersInit,
  enrollmentId: string
): Promise<AttendanceRead> {
  try {
    const response = await fetch(
      `${getGatewayBaseUrl()}/api/v1/attendance?${sessionAttendanceQueryString(enrollmentId)}`,
      { method: 'GET', headers, cache: 'no-store' }
    );

    if (response.status === 403) {
      return { records: [], forbidden: true };
    }

    const body = await readJson(response);

    if (!response.ok || !isSuccessEnvelope(body)) {
      return { records: [], forbidden: false };
    }

    return {
      records: normalizeSessionAttendance(normalizeListEnvelope(body.data).items),
      forbidden: false,
    };
  } catch {
    return { records: [], forbidden: false };
  }
}

/**
 * Loads the tenant's classes for the class filter options.
 *
 * A failed read degrades to no options instead of failing the page: the
 * sessions themselves do not depend on it, and the filter still offers the
 * range the backend understands.
 */
async function readClasses(headers: HeadersInit): Promise<{ id: string; name: string }[]> {
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/classes?page=1&page_size=100`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const body = await readJson(response);

    if (!response.ok || !isSuccessEnvelope(body)) {
      return [];
    }

    const items = normalizeListEnvelope(body.data).items as {
      id?: unknown;
      name?: unknown;
    }[];

    const classes: { id: string; name: string }[] = [];

    for (const item of items) {
      if (typeof item?.id === 'string' && item.id !== '' && typeof item?.name === 'string' && item.name.trim()) {
        classes.push({ id: item.id, name: item.name.trim() });
      }
    }

    return classes;
  } catch {
    return [];
  }
}

/**
 * Reads the tutor session overview for one filter state.
 *
 * The page makes one academic request for the sessions, then one attendee
 * request plus one attendance request per visible attendee. The attendance
 * lookups run together and a lookup that fails for a single row is treated
 * as "no attendance to show" instead of failing the page.
 */
export async function getTutorSessions(
  input: Record<string, string | string[] | undefined>
): Promise<TutorSessionResult> {
  const parsedFilters = parseSessionFilters(input);

  if (parsedFilters.error === 'invalid_filter') {
    return { data: null, error: 'invalid_filter' };
  }

  const filters: SessionFilters = parsedFilters.filters;

  try {
    const headers = await getAuthHeaders();
    const sessionRead = await readSessions(filters, headers);

    if (sessionRead.status === 401 || sessionRead.status === 403) {
      return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    }

    if (!sessionRead.ok) {
      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }

    const [rows, classes] = await Promise.all([
      Promise.all(
        sessionRead.items.map(async (session): Promise<TutorSessionRow> => {
          const attendees = isSessionUuid(session.id) ? await readAttendees(headers, session.id) : [];

          const reads = await Promise.all(
            attendees.map((attendee) => readEnrollmentAttendance(headers, attendee.enrollment_id))
          );

          const records = reads.flatMap((read) => read.records);
          const forbidden = reads.some((read) => read.forbidden);

          return {
            session,
            attendees,
            attendance: attendanceByEnrollment(records, session.id),
            ...(forbidden ? { attendanceForbidden: true } : {}),
          } satisfies TutorSessionRow;
        })
      ),
      readClasses(headers),
    ]);

    return { data: { rows, pagination: sessionRead.pagination, classes }, error: null };
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message:
        getGatewayConfigurationErrorMessage(error) ?? CONFIGURATION_FALLBACK_MESSAGE,
    };
  }
}
