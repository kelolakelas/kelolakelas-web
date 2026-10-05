import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeListEnvelope, type ListPagination } from '@/lib/list-envelope';
import {
  normalizeTenantTransaction,
  parseTransactionFilters,
  transactionListQuery,
  type TenantTransaction,
  type TransactionFilters,
} from '../_lib/transactions';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

export interface TenantTransactionOverview {
  filters: TransactionFilters;
  rows: TenantTransaction[];
  pagination: ListPagination;
}

/**
 * Result of reading the tenant transaction list (KEL-148).
 *
 * `forbidden` is a first-class state rather than an error page: billing
 * guards `GET /api/v1/billing/transactions` with `billing:read`, so a tenant
 * member without that permission is expected to land here and must be told
 * so without being shown a technical failure. `invalid_filter` means the URL
 * carried a value the backend would refuse with `400`. (The 366-day range
 * limit lives on the export/summary endpoints, not on this list, so a long
 * range here simply returns its rows.)
 */
export type TenantTransactionResult =
  | { data: TenantTransactionOverview; error: null }
  | { data: null; error: 'invalid_filter' }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string };

const FORBIDDEN_MESSAGE =
  'Anda tidak memiliki izin melihat daftar transaksi tenant ini. Hubungi administrator tenant untuk mendapatkan permission billing:read.';

const API_ERROR_MESSAGE = 'Daftar transaksi belum dapat dimuat. Coba muat ulang beberapa saat lagi.';

const CONFIGURATION_FALLBACK_MESSAGE =
  'Layanan transaksi sedang tidak tersedia. Coba lagi nanti.';

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
 * Reads the tenant transaction list for one filter state.
 *
 * Only the vocabulary the billing `List` handler understands is sent (see
 * `transactionListQuery`); the backend scopes every row to the caller's
 * tenant itself. Rows that fail normalisation are skipped rather than
 * failing the list. Never throws: every failure becomes a result state so the
 * rest of the dashboard keeps rendering.
 */
export async function getTenantTransactions(
  input: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): Promise<TenantTransactionResult> {
  const parsedFilters = parseTransactionFilters(input, now);

  if (parsedFilters.error === 'invalid_filter') {
    return { data: null, error: 'invalid_filter' };
  }

  const filters: TransactionFilters = parsedFilters.filters;

  let headers: HeadersInit;
  try {
    headers = await getAuthHeaders();
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message: getGatewayConfigurationErrorMessage(error) ?? CONFIGURATION_FALLBACK_MESSAGE,
    };
  }

  let response: Response;
  try {
    response = await fetch(
      `${getGatewayBaseUrl()}/api/v1/billing/transactions?${transactionListQuery(filters)}`,
      { method: 'GET', headers, cache: 'no-store' },
    );
  } catch (error) {
    const message = getGatewayConfigurationErrorMessage(error);
    return {
      data: null,
      error: message ? 'configuration' : 'api',
      message: message ?? API_ERROR_MESSAGE,
    };
  }

  if (response.status === 401 || response.status === 403) {
    return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
  }

  const body = await readJson(response);
  const envelope = normalizeListEnvelope<TenantTransaction>(
    isSuccessEnvelope(body) ? body.data : null,
  );

  if (!response.ok || !isSuccessEnvelope(body)) {
    return { data: null, error: 'api', message: API_ERROR_MESSAGE };
  }

  const rows: TenantTransaction[] = [];
  for (const entry of envelope.items) {
    const row = normalizeTenantTransaction(entry);
    if (row) rows.push(row);
  }

  return { data: { filters, rows, pagination: envelope.pagination }, error: null };
}
