import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeListEnvelope, type ListPagination } from '@/lib/list-envelope';
import {
  isReportUuid,
  normalizeReportEnrollment,
  normalizeTenantReport,
  parseReportFilters,
  reportClassName,
  reportQueryString,
  reportStudentName,
  type ReportEnrollment,
  type ReportFilters,
  type TenantReport,
} from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/** One report row together with the enrollment it evaluates. */
export interface TenantReportRow {
  report: TenantReport;
}

export interface TenantReportOverview {
  rows: TenantReportRow[];
  pagination: ListPagination;
  /**
   * Enrollments the create form can address.
   *
   * The direct enrollment list needs `enrollment:read`, which the default
   * Teacher role does not grant; the taught-enrollment lookup needs only
   * `schedule:read`, which the Teacher does hold. The reader prefers the
   * direct list (it covers roles with `enrollment:read` without the
   * per-session reads) and falls back to the taught lookup, then to the
   * enrollments already visible on the page — so a Teacher can still address
   * the students they teach even for the first report, when no row exists
   * to derive an option from.
   */
  enrollments: { enrollment_id: string; label: string }[];
}

/**
 * Result of reading the tenant report overview.
 *
 * `forbidden` is a first-class state rather than an error page: the academic
 * service guards `GET /api/v1/reports` with `report:read`, so a tenant
 * member without that permission is expected to land here and must be told
 * so without being shown a technical failure.
 */
export type TenantReportResult =
  | { data: TenantReportOverview; error: null }
  | { data: null; error: 'invalid_filter' }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string };

const FORBIDDEN_MESSAGE =
  'Anda tidak memiliki izin melihat laporan tenant ini. Hubungi administrator tenant untuk mendapatkan permission report:read.';

const API_ERROR_MESSAGE = 'Daftar laporan belum dapat dimuat. Coba muat ulang beberapa saat lagi.';

const CONFIGURATION_FALLBACK_MESSAGE =
  'Layanan laporan sedang tidak tersedia. Coba lagi nanti.';

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

interface ReportRead {
  status: number;
  ok: boolean;
  items: TenantReport[];
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
 * Reads the tenant report list for one filter state.
 *
 * Only the vocabulary the academic `parseReportQuery` understands is sent
 * (see `reportQueryString`); the backend scopes every row to the caller's
 * tenant itself.
 */
async function readReports(filters: ReportFilters, headers: HeadersInit): Promise<ReportRead> {
  const response = await fetch(`${getGatewayBaseUrl()}/api/v1/reports?${reportQueryString(filters)}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const body = await readJson(response);
  const envelope = normalizeListEnvelope<TenantReport>(
    isSuccessEnvelope(body) ? body.data : null
  );

  const succeeded = response.ok && isSuccessEnvelope(body);
  const items: TenantReport[] = [];

  if (succeeded) {
    for (const entry of envelope.items) {
      const report = normalizeTenantReport(entry);
      if (report) items.push(report);
    }
  }

  return {
    status: response.status,
    ok: succeeded,
    items,
    pagination: envelope.pagination,
  };
}

/**
 * Page size for the on-demand picker reads (KEL-167).
 *
 * Matches the backend `MaxPageSize` (academic `internal/domain/validation.go`),
 * so one explicit page carries as much as the service allows. The picker
 * reads exactly one page per explicit search/pagination action — it never
 * prefetches the whole history the way the old create-form options did.
 */
const PICKER_PAGE_SIZE = 100;

/**
 * Absolute backend page bound (`MaxPage` in academic
 * `internal/domain/validation.go`). The service answers `400` past it, which
 * the readers below surface as an explicit `limit` state — never as a silent
 * truncation.
 */
const BACKEND_MAX_PAGE = 1000;

/** Normalises raw enrollment-shaped entries, dropping the unusable ones. */
function normalizeEnrollmentEntries(items: unknown): ReportEnrollment[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const enrollments: ReportEnrollment[] = [];

  for (const entry of items) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const candidate = entry as { id?: unknown; student?: unknown; class?: unknown };
    const normalized = normalizeReportEnrollment({
      id: candidate.id,
      student: candidate.student,
      class: candidate.class,
    });

    if (normalized) enrollments.push(normalized);
  }

  return enrollments;
}

/** Search text bound: the backend `MaxSearchLength` (varchar(255) academic names). */
const PICKER_SEARCH_MAX = 255;

/** Message when the backend absolute page bound stops the walk. */
const PICKER_LIMIT_MESSAGE =
  'Batas halaman API tercapai (1000 halaman). Sempitkan pencarian nama siswa atau kelas untuk menemukan siswa.';

/** One enrollment the picker can address. */
export interface EnrollmentPickerItem {
  enrollment_id: string;
  label: string;
  class_id: string;
  class_name: string;
}

/** One distinct class on the active picker page (Teacher two-step). */
export interface EnrollmentPickerClass {
  class_id: string;
  name: string;
}

/** One explicitly requested picker page. */
export interface EnrollmentPickerPage {
  items: EnrollmentPickerItem[];
  classes: EnrollmentPickerClass[];
  pagination: ListPagination;
  /**
   * Attendee reads that failed while resolving this page (Teacher path).
   * The page still resolves the sessions that did load; the picker reports
   * the count instead of hiding the page.
   */
  partialFailures: number;
}

export type EnrollmentPickerResult =
  | { data: EnrollmentPickerPage; error: null }
  | { data: null; error: 'forbidden' | 'api' | 'configuration' | 'limit'; message: string };

function pickerSearch(search: string): string {
  return search.trim().slice(0, PICKER_SEARCH_MAX);
}

/**
 * Explicit page number, or `null` past the backend absolute bound.
 * The service answers `400` past `MaxPage`, so the readers surface `limit`
 * before any request goes out — never a silent truncation.
 */
function pickerPage(page: number): number | null {
  if (!Number.isInteger(page) || page < 1 || page > BACKEND_MAX_PAGE) {
    return null;
  }

  return page;
}

/** Distinct classes behind one picker page, for the class-first step. */
function pickerClasses(items: EnrollmentPickerItem[]): EnrollmentPickerClass[] {
  const seen = new Map<string, string>();

  for (const item of items) {
    if (item.class_id && !seen.has(item.class_id)) {
      seen.set(item.class_id, item.class_name);
    }
  }

  return [...seen.entries()].map(([class_id, name]) => ({ class_id, name }));
}

function toPickerItem(enrollment: ReportEnrollment): EnrollmentPickerItem {
  // The direct list carries the flat `class_id` from the service; the
  // taught path builds the enrollment from an attendee (`id` + `student`)
  // plus the session's class object, so the nested `class.id` is the
  // fallback — without it the class filter keys on an empty string.
  const nestedClassId =
    enrollment.class && typeof enrollment.class === 'object' && 'id' in enrollment.class
      ? (enrollment.class as { id?: unknown }).id
      : undefined;
  const classId =
    typeof enrollment.class_id === 'string' && enrollment.class_id !== ''
      ? enrollment.class_id
      : typeof nestedClassId === 'string'
        ? nestedClassId
        : '';

  return {
    enrollment_id: enrollment.id,
    label: `${reportStudentName(enrollment.student ?? null)} · ${reportClassName(enrollment)}`,
    class_id: classId,
    class_name: reportClassName(enrollment),
  };
}

/**
 * Reads one explicit page of the tenant's active enrollments (KEL-167).
 *
 * This route needs `enrollment:read`, which the default Teacher role does
 * not grant — a refusal answers `forbidden` (distinct from a failure) so
 * the picker falls back to the taught-session lookup below. `search`
 * matches the student first/last/nickname or the class name server-side
 * (academic `enrollment_repository.go`), so a Creator finds an enrollment
 * far past the first page without downloading the history.
 *
 * Exactly one request goes out per call: pagination is explicit, never a
 * prefetch. A `400` answers `limit` because the only vocabulary sent that
 * the service can refuse is the page itself.
 */
export async function searchDirectEnrollmentOptions(
  search: string,
  page: number
): Promise<EnrollmentPickerResult> {
  const trimmed = pickerSearch(search);
  const safePage = pickerPage(page);

  if (safePage === null) {
    return { data: null, error: 'limit', message: PICKER_LIMIT_MESSAGE };
  }

  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({
      page: String(safePage),
      page_size: String(PICKER_PAGE_SIZE),
      status: 'active',
    });

    if (trimmed) {
      params.set('search', trimmed);
    }

    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/enrollments?${params.toString()}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    const body = await readJson(response);

    if (response.status === 401 || response.status === 403) {
      return {
        data: null,
        error: 'forbidden',
        message:
          'Anda tidak memiliki izin membaca enrollment. Hubungi administrator tenant untuk mendapatkan permission enrollment:read.',
      };
    }

    if (!response.ok || !isSuccessEnvelope(body)) {
      if (response.status === 400) {
        return { data: null, error: 'limit', message: PICKER_LIMIT_MESSAGE };
      }

      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }

    const envelope = normalizeListEnvelope(body.data);
    const seen = new Set<string>();
    const items: EnrollmentPickerItem[] = [];

    for (const enrollment of normalizeEnrollmentEntries(envelope.items)) {
      if (seen.has(enrollment.id)) {
        continue;
      }

      seen.add(enrollment.id);
      items.push(toPickerItem(enrollment));
    }

    return {
      data: { items, classes: pickerClasses(items), pagination: envelope.pagination, partialFailures: 0 },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message:
        getGatewayConfigurationErrorMessage(error) ?? CONFIGURATION_FALLBACK_MESSAGE,
    };
  }
}

/**
 * Reads one explicit page of taught sessions and resolves their attendees
 * (KEL-167, Teacher path).
 *
 * `GET /api/v1/sessions?mine=true` is guarded by `schedule:read`, which is
 * part of the default Teacher role; the route needs no `enrollment:read`.
 * The backend `search` parameter only matches the class name
 * (`session_repository.go`), so the search box runs the class-first step:
 * the class names found on the requested page feed the class filter, and
 * the members below are that page's students. Each session's attendee
 * route returns the assigned enrollment with its student. This is
 * deliberately a read-only lookup: the report create action still asks the
 * academic service to enforce assignment.
 *
 * Exactly one session page is read per call; its attendee reads run in
 * chunks (`ATTENDEE_CONCURRENCY`) so a 100-session page does not burst the
 * service. One attendee read runs per session — cohort results are
 * deliberately not reused across sessions: a private session answers a
 * single enrollment while a group session answers its schedule cohort (a
 * reschedule replacement even resolves its origin schedule's cohort), so
 * sharing one response across sessions would mix enrollments between
 * classes.
 *
 * Failures are counted, never silent: a failed attendee read counts one
 * partial failure. The first page failing with
 * 401/403 answers `forbidden` so the picker can explain the missing
 * permission instead of an empty list; any other first-page failure is an
 * `api` error. Deduplication collapses repeated enrollments across
 * sessions of the same schedule cohort.
 */
const ATTENDEE_CONCURRENCY = 5;

export async function searchTaughtEnrollmentOptions(
  search: string,
  page: number
): Promise<EnrollmentPickerResult> {
  const trimmed = pickerSearch(search);
  const safePage = pickerPage(page);

  if (safePage === null) {
    return { data: null, error: 'limit', message: PICKER_LIMIT_MESSAGE };
  }

  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({
      mine: 'true',
      page: String(safePage),
      page_size: String(PICKER_PAGE_SIZE),
    });

    if (trimmed) {
      params.set('search', trimmed);
    }

    const sessionsResponse = await fetch(
      `${getGatewayBaseUrl()}/api/v1/sessions?${params.toString()}`,
      { method: 'GET', headers, cache: 'no-store' }
    );
    const sessionsBody = await readJson(sessionsResponse);

    if (sessionsResponse.status === 401 || sessionsResponse.status === 403) {
      return {
        data: null,
        error: 'forbidden',
        message:
          'Anda tidak memiliki izin membaca sesi mengajar. Hubungi administrator tenant untuk mendapatkan permission schedule:read.',
      };
    }

    if (!sessionsResponse.ok || !isSuccessEnvelope(sessionsBody)) {
      if (sessionsResponse.status === 400) {
        return { data: null, error: 'limit', message: PICKER_LIMIT_MESSAGE };
      }

      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }

    const envelope = normalizeListEnvelope(sessionsBody.data);
    const sessions = envelope.items as { id?: unknown; class_id?: unknown; class?: unknown }[];

    // The class object rides on every session, but a serialisation that
    // drops it on one session can still be filled from a sibling session
    // of the same class on this page.
    const classBySessionId = new Map<string, unknown>();
    const classByClassId = new Map<string, unknown>();

    for (const session of sessions) {
      if (!session || typeof session !== 'object' || typeof session.id !== 'string') {
        continue;
      }

      if (!isReportUuid(session.id) || classBySessionId.has(session.id)) {
        continue;
      }

      const classId = typeof session.class_id === 'string' ? session.class_id : '';
      const klass =
        session.class && typeof session.class === 'object'
          ? session.class
          : (classId ? classByClassId.get(classId) : undefined);

      if (klass && classId && !classByClassId.has(classId)) {
        classByClassId.set(classId, klass);
      }

      classBySessionId.set(session.id, klass ?? null);
    }

    const sessionEntries = [...classBySessionId.entries()];
    let partialFailures = 0;
    const attendeeLists: ReportEnrollment[][] = [];

    for (let start = 0; start < sessionEntries.length; start += ATTENDEE_CONCURRENCY) {
      const chunk = sessionEntries.slice(start, start + ATTENDEE_CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(async ([sessionId, sessionClass]) => {
          try {
            const attendeesResponse = await fetch(
              `${getGatewayBaseUrl()}/api/v1/sessions/${encodeURIComponent(sessionId)}/attendees`,
              { method: 'GET', headers, cache: 'no-store' }
            );
            const attendeesBody = await readJson(attendeesResponse);

            if (!attendeesResponse.ok || !isSuccessEnvelope(attendeesBody)) {
              return null;
            }

            const attendees = normalizeListEnvelope(attendeesBody.data).items as {
              id?: unknown;
              student?: unknown;
            }[];

            return attendees.flatMap((attendee) => {
              const enrollment = normalizeReportEnrollment({
                id: attendee?.id,
                student: attendee?.student,
                class: sessionClass,
              });
              return enrollment ? [enrollment] : [];
            });
          } catch {
            return null;
          }
        })
      );

      for (const result of chunkResults) {
        if (result === null) {
          partialFailures += 1;
        } else {
          attendeeLists.push(result);
        }
      }
    }

    const unique = new Map<string, ReportEnrollment>();
    for (const enrollment of attendeeLists.flat()) {
      if (!unique.has(enrollment.id)) {
        unique.set(enrollment.id, enrollment);
      }
    }

    const items = [...unique.values()].map(toPickerItem);

    return {
      data: { items, classes: pickerClasses(items), pagination: envelope.pagination, partialFailures },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message:
        getGatewayConfigurationErrorMessage(error) ?? CONFIGURATION_FALLBACK_MESSAGE,
    };
  }
}

/**
 * Reads the tenant report overview for one filter state.
 *
 * The page makes one academic request for the reports. The create-form
 * student picker reads on demand through the exported search readers above
 * (KEL-167), so opening this screen never downloads the enrollment or
 * session history. The `enrollments` options here carry only the
 * enrollments already visible on the page's own rows, which feed the
 * filter select; they never hide the reports when empty.
 */
export async function getTenantReports(
  input: Record<string, string | string[] | undefined>
): Promise<TenantReportResult> {
  const parsedFilters = parseReportFilters(input);

  if (parsedFilters.error === 'invalid_filter') {
    return { data: null, error: 'invalid_filter' };
  }

  const filters: ReportFilters = parsedFilters.filters;

  try {
    const headers = await getAuthHeaders();
    const reportRead = await readReports(filters, headers);

    if (reportRead.status === 401 || reportRead.status === 403) {
      return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    }

    if (!reportRead.ok) {
      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }

    const seen = new Set<string>();
    const options: { enrollment_id: string; label: string }[] = [];

    const pushOption = (enrollment: ReportEnrollment | null | undefined) => {
      if (!enrollment || seen.has(enrollment.id)) {
        return;
      }

      seen.add(enrollment.id);
      options.push({
        enrollment_id: enrollment.id,
        label: `${reportStudentName(enrollment.student ?? null)} · ${reportClassName(enrollment)}`,
      });
    };

    for (const report of reportRead.items) {
      pushOption(report.enrollment ?? null);
    }

    return {
      data: {
        rows: reportRead.items.map((report) => ({ report })),
        pagination: reportRead.pagination,
        enrollments: options,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message:
        getGatewayConfigurationErrorMessage(error) ?? CONFIGURATION_FALLBACK_MESSAGE,
    };
  }
}
