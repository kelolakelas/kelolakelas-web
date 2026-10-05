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
 * Page size for the auxiliary enrollment/session lookups behind the
 * create-form options. Matches the backend `MaxPageSize` (academic
 * `internal/domain/validation.go`), so one page carries as much as the
 * service allows.
 */
const AUX_PAGE_SIZE = 100;

/**
 * Hard cap on auxiliary pages walked for the create-form options.
 *
 * The session list is ordered newest-first (`session_date DESC`), so a
 * teacher with a long history can teach a class that only appears past
 * page 1; the reader must follow the envelope's `total_pages`. The cap
 * keeps a pathological history from turning one page view into an
 * unbounded fan-out of attendee reads. Ten pages (1000 sessions or
 * enrollments) cover realistic tenants; beyond that the report rows on
 * the page still supply options.
 */
const MAX_AUX_PAGES = 10;

/**
 * Attendee reads in flight at once. Sessions are walked in chunks of this
 * size instead of one `Promise.all` over the whole history, so a teacher
 * with hundreds of sessions does not burst the academic service.
 */
const ATTENDEE_CONCURRENCY = 5;

/**
 * Pages the backend envelope says exist, honouring malformed input safely.
 * A missing or non-integer `total_pages` reads as a single page; an absurd
 * value is clamped to `MAX_AUX_PAGES` so pagination always terminates.
 */
function auxTotalPages(data: unknown): number {
  const totalPages = normalizeListEnvelope(data).pagination.total_pages;

  if (!Number.isInteger(totalPages) || totalPages < 1) {
    return 1;
  }

  return Math.min(totalPages, MAX_AUX_PAGES);
}

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

/**
 * Reads the tenant's active enrollments for the create-form options.
 *
 * This route is useful for Creator and other members with `enrollment:read`,
 * but the default Teacher role deliberately does not have that permission.
 * A failed read answers `null` (distinct from a successful empty list) so
 * the caller falls back to the taught-session lookup below rather than
 * treating an expected refusal as a page failure.
 *
 * Every page the envelope reports is walked (bounded by `MAX_AUX_PAGES`):
 * a Creator with more than one page of enrollments must still see the
 * students on the later pages. A failed later page is skipped so a partial
 * outage degrades to the pages that did load instead of hiding the reports.
 */
async function readEnrollments(headers: HeadersInit): Promise<ReportEnrollment[] | null> {
  try {
    const firstResponse = await fetch(
      `${getGatewayBaseUrl()}/api/v1/enrollments?page=1&page_size=${AUX_PAGE_SIZE}&status=active`,
      { method: 'GET', headers, cache: 'no-store' }
    );

    const firstBody = await readJson(firstResponse);

    if (!firstResponse.ok || !isSuccessEnvelope(firstBody)) {
      return null;
    }

    const firstEnvelope = normalizeListEnvelope(firstBody.data);
    const enrollments = normalizeEnrollmentEntries(firstEnvelope.items);
    const totalPages = auxTotalPages(firstBody.data);

    for (let page = 2; page <= totalPages; page += 1) {
      try {
        const response = await fetch(
          `${getGatewayBaseUrl()}/api/v1/enrollments?page=${page}&page_size=${AUX_PAGE_SIZE}&status=active`,
          { method: 'GET', headers, cache: 'no-store' }
        );
        const body = await readJson(response);

        if (!response.ok || !isSuccessEnvelope(body)) {
          continue;
        }

        enrollments.push(...normalizeEnrollmentEntries(normalizeListEnvelope(body.data).items));
      } catch {
        continue;
      }
    }

    return enrollments;
  } catch {
    return null;
  }
}

/**
 * Reads enrollments from sessions assigned to the current teacher.
 *
 * `GET /api/v1/sessions?mine=true` is guarded by `schedule:read`, which is
 * part of the default Teacher role. Each session's attendee route returns
 * the assigned enrollment with its student, while the session carries the
 * preloaded class. This is deliberately a read-only fallback: the report
 * create action still asks the academic service to enforce assignment.
 *
 * Every session page the envelope reports is walked with `mine=true`
 * (bounded by `MAX_AUX_PAGES`): the list is ordered newest-first
 * (`session_date DESC`), so a taught class can sit past page 1. Attendee
 * reads run in small chunks (`ATTENDEE_CONCURRENCY`) rather than one
 * `Promise.all` over the whole history. One attendee read runs per
 * session — cohort results are deliberately not reused across sessions:
 * a private session answers a single enrollment while a group session
 * answers its schedule cohort (a reschedule replacement even resolves its
 * origin schedule's cohort), so sharing one response across sessions
 * would mix enrollments between classes.
 */
async function readTaughtEnrollments(headers: HeadersInit): Promise<ReportEnrollment[]> {
  try {
    const sessionsById = new Map<string, unknown>();

    for (let page = 1; page <= MAX_AUX_PAGES; page += 1) {
      let sessionsResponse: Response;
      try {
        sessionsResponse = await fetch(
          `${getGatewayBaseUrl()}/api/v1/sessions?mine=true&page=${page}&page_size=${AUX_PAGE_SIZE}`,
          { method: 'GET', headers, cache: 'no-store' }
        );
      } catch {
        if (page === 1) return [];
        continue;
      }
      const sessionsBody = await readJson(sessionsResponse);

      if (!sessionsResponse.ok || !isSuccessEnvelope(sessionsBody)) {
        if (page === 1) return [];
        continue;
      }

      const envelope = normalizeListEnvelope(sessionsBody.data);
      const sessions = envelope.items as { id?: unknown; class?: unknown }[];

      for (const session of sessions) {
        if (
          session &&
          typeof session === 'object' &&
          typeof session.id === 'string' &&
          isReportUuid(session.id) &&
          !sessionsById.has(session.id)
        ) {
          sessionsById.set(session.id, session.class);
        }
      }

      const totalPages = auxTotalPages(sessionsBody.data);
      if (page >= totalPages) break;
    }

    const sessionEntries = [...sessionsById.entries()];
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
              return [] as ReportEnrollment[];
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
            return [] as ReportEnrollment[];
          }
        })
      );
      attendeeLists.push(...chunkResults);
    }

    const unique = new Map<string, ReportEnrollment>();
    for (const enrollment of attendeeLists.flat()) {
      unique.set(enrollment.id, enrollment);
    }
    return [...unique.values()];
  } catch {
    return [];
  }
}

/**
 * Reads the tenant report overview for one filter state.
 *
 * The page makes one academic request for the reports, then tries the
 * enrollment list and the Teacher-authorized taught-session lookup for the
 * create-form options. Auxiliary lookup failures degrade to visible report
 * enrollments or an explicit empty form state; they never hide the reports.
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

    const directRead = await readEnrollments(headers);
    const taughtEnrollments =
      directRead === null ? await readTaughtEnrollments(headers) : [];
    const directEnrollments = directRead ?? [];

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

    for (const enrollment of [...directEnrollments, ...taughtEnrollments]) {
      pushOption(enrollment);
    }

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
