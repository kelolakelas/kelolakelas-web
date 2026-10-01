import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from '@/lib/gateway';
import { normalizeListEnvelope, type ListPagination } from '@/lib/list-envelope';
import { voucherQueryString, voucherSchema, type TenantVoucher } from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

const FORBIDDEN_MESSAGE =
  'Anda tidak memiliki izin melihat voucher tenant ini. Hubungi administrator tenant untuk mendapatkan permission voucher:read.';

const API_ERROR_MESSAGE = 'Data voucher belum dapat dimuat. Coba muat ulang beberapa saat lagi.';

const CONFIGURATION_FALLBACK_MESSAGE = 'Layanan voucher sedang tidak tersedia. Coba lagi nanti.';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeVoucher(raw: unknown): TenantVoucher | null {
  const parsed = voucherSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Result of reading one page of the tenant's vouchers.
 *
 * `forbidden` is a first-class state rather than an error page: billing guards
 * `GET /api/v1/billing/vouchers` with `voucher:read`, so a tenant member
 * without that permission is expected to land here and must be told so without
 * being shown a technical failure.
 */
export type TenantVoucherListResult =
  | { data: { vouchers: TenantVoucher[]; pagination: ListPagination }; error: null }
  | { data: null; error: 'forbidden' | 'api' | 'configuration'; message: string };

/**
 * Fetches one page of the tenant's vouchers with their usage counts.
 * Target Endpoint: GET /api/v1/billing/vouchers
 *
 * Malformed rows are dropped (never rendered as wrong figures), while a
 * malformed envelope as a whole is an error.
 */
export async function getTenantVouchers(page = 1): Promise<TenantVoucherListResult> {
  let baseUrl: string;
  try {
    baseUrl = getGatewayBaseUrl();
  } catch {
    return { data: null, error: 'configuration', message: CONFIGURATION_FALLBACK_MESSAGE };
  }

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/billing/vouchers?${voucherQueryString(page)}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (response.status === 403) {
      return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    }
    if (!response.ok) {
      console.warn('[getTenantVouchers] Non-OK response:', response.status);
      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }

    const result: unknown = await response.json();
    if (!isRecord(result) || result.status !== 'success' || !('data' in result)) {
      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }

    const normalized = normalizeListEnvelope<TenantVoucher>(result.data);
    const vouchers = normalized.items
      .map((item) => normalizeVoucher(item))
      .filter((voucher): voucher is TenantVoucher => voucher !== null);

    return { data: { vouchers, pagination: normalized.pagination }, error: null };
  } catch (error) {
    console.error('[getTenantVouchers Error]:', error);
    return { data: null, error: 'api', message: API_ERROR_MESSAGE };
  }
}

/**
 * Result of reading one tenant voucher.
 */
export type TenantVoucherDetailResult =
  | { data: TenantVoucher; error: null }
  | { data: null; error: 'forbidden' | 'not_found' | 'api' | 'configuration'; message: string };

const VOUCHER_GONE_MESSAGE =
  'Voucher ini tidak lagi tersedia. Mungkin sudah dihapus di sesi lain. Muat ulang daftar untuk melihat voucher saat ini.';

/**
 * Fetches one tenant voucher by id.
 * Target Endpoint: GET /api/v1/billing/vouchers/:id
 *
 * A voucher of another tenant answers 404 from billing, never its row, so
 * `not_found` covers both missing and foreign ids without distinguishing them.
 */
export async function getTenantVoucher(id: string): Promise<TenantVoucherDetailResult> {
  let baseUrl: string;
  try {
    baseUrl = getGatewayBaseUrl();
  } catch {
    return { data: null, error: 'configuration', message: CONFIGURATION_FALLBACK_MESSAGE };
  }

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/billing/vouchers/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (response.status === 403) {
      return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    }
    if (response.status === 404) {
      return { data: null, error: 'not_found', message: VOUCHER_GONE_MESSAGE };
    }
    if (!response.ok) {
      console.warn('[getTenantVoucher] Non-OK response:', response.status);
      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }

    const result: unknown = await response.json();
    if (!isRecord(result) || result.status !== 'success' || !('data' in result)) {
      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }
    const voucher = normalizeVoucher(result.data);
    if (!voucher) {
      return { data: null, error: 'api', message: API_ERROR_MESSAGE };
    }
    return { data: voucher, error: null };
  } catch (error) {
    console.error('[getTenantVoucher Error]:', error);
    return { data: null, error: 'api', message: API_ERROR_MESSAGE };
  }
}
