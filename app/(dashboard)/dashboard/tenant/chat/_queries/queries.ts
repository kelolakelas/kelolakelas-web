import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeListEnvelope, type ListPagination } from '@/lib/list-envelope';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

const PAGE_SIZE = 10;

const FORBIDDEN_MESSAGE =
  'Anda tidak memiliki izin melihat laporan tenant ini. Hubungi administrator tenant untuk mendapatkan permission report:read.';

const API_ERROR_MESSAGE = 'Daftar laporan belum dapat dimuat. Coba muat ulang beberapa saat lagi.';

const CONFIGURATION_FALLBACK_MESSAGE = 'Layanan laporan sedang tidak tersedia. Coba lagi nanti.';

/**
 * One student report row as the chat entry picker needs it (KEL-124).
 *
 * Only the identity needed to start a `report` conversation plus a display
 * title: the report body itself is never shown on the chat page (out of
 * scope). Every field is read defensively because the picker must degrade
 * to a neutral row rather than crash on an unexpected shape.
 */
export interface TenantReport {
  id: string;
  title: string;
  created_at: string | null;
}

export interface TenantReportList {
  items: TenantReport[];
  pagination: ListPagination;
}

/**
 * Result of reading the tenant report list.
 *
 * `forbidden` is a first-class state rather than an error: the academic
 * service guards `GET /api/v1/reports` with `report:read` (parent tokens
 * skipped), so a member without that permission is expected here and the
 * picker hides itself instead of showing a failure.
 */
export type TenantReportsResult =
  | { data: TenantReportList; error: null }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string };

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

function normalizeReport(value: unknown): TenantReport | null {
  if (typeof value !== 'object' || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || item.id === '') return null;
  return {
    id: item.id,
    title: typeof item.title === 'string' && item.title.trim() ? item.title : 'Laporan',
    created_at: typeof item.created_at === 'string' ? item.created_at : null,
  };
}

/**
 * Reads one page of the caller-scoped report list.
 *
 * The backend scopes rows to the caller's tenant; `search` matches the
 * report title/notes server-side and `page` walks the paginated envelope.
 * Rows that fail normalisation are skipped rather than failing the list.
 */
export async function getTenantReports(input: { search?: string; page?: number }): Promise<TenantReportsResult> {
  const page = typeof input.page === 'number' && Number.isInteger(input.page) && input.page >= 1 ? input.page : 1;
  const search = typeof input.search === 'string' ? input.search.trim().slice(0, 255) : '';

  try {
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (search) params.set('search', search);

    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/reports?${params.toString()}`, {
      method: 'GET',
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (response.status === 401 || response.status === 403) {
      return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    }

    const body = await response.json().catch(() => null);

    if (!response.ok || !body || typeof body !== 'object' || (body as { status?: unknown }).status !== 'success') {
      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }

    const envelope = normalizeListEnvelope<unknown>((body as { data?: unknown }).data);
    const items: TenantReport[] = [];
    for (const entry of envelope.items) {
      const report = normalizeReport(entry);
      if (report) items.push(report);
    }

    return { data: { items, pagination: envelope.pagination }, error: null };
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message: getGatewayConfigurationErrorMessage(error) ?? CONFIGURATION_FALLBACK_MESSAGE,
    };
  }
}
