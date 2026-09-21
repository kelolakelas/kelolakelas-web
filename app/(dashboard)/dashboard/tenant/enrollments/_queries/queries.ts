import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeListEnvelope, type ListPagination } from '@/lib/list-envelope';
import type { TransactionRecord } from '@/lib/payment-status';
import {
  enrollmentQueryString,
  isEnrollmentId,
  parseEnrollmentFilters,
  pickEnrollmentTransaction,
  scheduleQueryString,
  schedulesById,
  transactionQueryString,
  type EnrollmentFilters,
  type TenantEnrollment,
  type TenantSchedule,
} from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * One enrollment together with the payment facts this screen may display.
 *
 * The transaction is nullable because an enrollment legitimately has no
 * transaction row: the seat is created before billing is called, so an invoice
 * whose creation failed leaves an enrollment that no billing row points at.
 * `paymentPresentation` turns that absence into an explicit state, which is why
 * the raw row is passed through instead of being pre-summarised here.
 */
export interface TenantEnrollmentRow {
  enrollment: TenantEnrollment;
  transaction?: TransactionRecord;
  schedule?: TenantSchedule;
}

export interface TenantEnrollmentOverview {
  rows: TenantEnrollmentRow[];
  pagination: ListPagination;
}

/**
 * Result of reading the tenant enrollment overview.
 *
 * `forbidden` is a first-class state rather than an error page: since KEL-21 the
 * academic service guards `GET /api/v1/enrollments` with `enrollment:read`, so a
 * tenant member without that permission is expected to land here and must be
 * told so without being shown a technical failure.
 */
export type TenantEnrollmentResult =
  | { data: TenantEnrollmentOverview; error: null }
  | { data: null; error: 'invalid_filter' }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string };

const FORBIDDEN_MESSAGE =
  'Anda tidak memiliki izin melihat enrollment tenant ini. Hubungi administrator tenant untuk mendapatkan permission enrollment:read.';

const API_ERROR_MESSAGE = 'Data enrollment belum dapat dimuat. Coba muat ulang beberapa saat lagi.';

const CONFIGURATION_FALLBACK_MESSAGE =
  'Layanan enrollment sedang tidak tersedia. Coba lagi nanti.';

/**
 * Extracts authorization and tenant headers from server cookies.
 *
 * The tenant is resolved from the session server-side. A tenant identifier sent
 * by the browser is never treated as an authorization source: the API gateway
 * strips client-supplied context headers and the downstream services derive the
 * tenant from the JWT claim only.
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

interface ListRead<T> {
  status: number;
  ok: boolean;
  items: T[];
  pagination: ListPagination;
}

/**
 * Reads one paginated list endpoint.
 *
 * The body is unwrapped with `normalizeListEnvelope` because these endpoints
 * answer with `{"status":"success","data":{"items":[...],"pagination":{...}}}`
 * and reading `data` as a bare array would silently yield zero rows. Only a
 * `2xx` answer whose `status` is `success` counts as usable; anything else is
 * reported to the caller so it can decide between `forbidden` and `api`.
 */
async function readList<T>(
  path: string,
  headers: HeadersInit
): Promise<ListRead<T>> {
  const response = await fetch(`${getGatewayBaseUrl()}${path}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const body: unknown = await response.json().catch(() => null);
  const envelope = normalizeListEnvelope<T>(
    body && typeof body === 'object' && (body as { status?: unknown }).status === 'success'
      ? (body as { data?: unknown }).data
      : null
  );

  const status = response.status;
  const succeeded =
    response.ok && Boolean(body) && (body as { status?: unknown }).status === 'success';

  return {
    status,
    ok: succeeded,
    items: succeeded ? envelope.items : [],
    pagination: envelope.pagination,
  };
}

/** Whether a failed read was refused for lack of authorization. */
function isForbidden(read: ListRead<unknown>): boolean {
  return read.status === 401 || read.status === 403;
}

/**
 * Reads the tenant enrollment overview for one filter state.
 *
 * Enrollments and their payments live in two services, so the page makes one
 * academic request and then one billing request per visible enrollment. The
 * payment lookups run together and a lookup that fails for a single row is
 * treated as "no payment to show" instead of failing the page: the enrollment
 * list is the primary content, and `paymentPresentation` already renders a
 * missing transaction as its own state.
 */
export async function getTenantEnrollments(
  input: Record<string, string | string[] | undefined>
): Promise<TenantEnrollmentResult> {
  const parsedFilters = parseEnrollmentFilters(input);

  if (parsedFilters.error === 'invalid_filter') {
    return { data: null, error: 'invalid_filter' };
  }

  const filters: EnrollmentFilters = parsedFilters.filters;

  try {
    const headers = await getAuthHeaders();

    const [enrollmentRead, scheduleRead] = await Promise.all([
      readList<TenantEnrollment>(`/api/v1/enrollments?${enrollmentQueryString(filters)}`, headers),
      readList<TenantSchedule>(`/api/v1/schedules?${scheduleQueryString()}`, headers),
    ]);

    if (isForbidden(enrollmentRead)) {
      return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    }

    if (!enrollmentRead.ok) {
      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }

    const transactions = await loadTransactions(
      headers,
      enrollmentRead.items.map((enrollment) => enrollment.id)
    );

    // A schedule lookup is only a labelling aid; losing it must not hide the
    // enrollments themselves.
    const schedules = scheduleRead.ok ? schedulesById(scheduleRead.items) : new Map();

    return {
      data: {
        rows: enrollmentRead.items.map((enrollment) => {
          const transaction = transactions.get(enrollment.id);
          const scheduleId = enrollment.schedule_id;
          const schedule =
            typeof scheduleId === 'string' && scheduleId !== ''
              ? schedules.get(scheduleId)
              : undefined;

          return {
            enrollment,
            ...(transaction ? { transaction } : {}),
            ...(schedule ? { schedule } : {}),
          } satisfies TenantEnrollmentRow;
        }),
        pagination: enrollmentRead.pagination,
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

/**
 * Loads the current payment of each visible enrollment, keyed by enrollment id.
 *
 * Enrollments without a UUID id are skipped because the billing service rejects
 * a malformed `enrollment_id` with `400`, which would otherwise fail the whole
 * batch over one unusable identifier.
 */
async function loadTransactions(
  headers: HeadersInit,
  enrollmentIds: readonly unknown[]
): Promise<Map<string, TransactionRecord>> {
  const lookups = enrollmentIds
    .filter(isEnrollmentId)
    .map(async (enrollmentId) => {
      try {
        const read = await readList<TransactionRecord>(
          `/api/v1/billing/transactions?${transactionQueryString(enrollmentId)}`,
          headers
        );

        if (!read.ok) {
          return null;
        }

        const transaction = pickEnrollmentTransaction(read.items);

        return transaction ? ([enrollmentId, transaction] as const) : null;
      } catch {
        return null;
      }
    });

  const settled = await Promise.all(lookups);
  const byEnrollment = new Map<string, TransactionRecord>();

  for (const entry of settled) {
    if (entry && entry[1]) {
      byEnrollment.set(entry[0], entry[1]);
    }
  }

  return byEnrollment;
}
