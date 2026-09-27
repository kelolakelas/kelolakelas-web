import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from '@/lib/gateway';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/** Paid sales of one currency. Amounts in different currencies are never added together. */
export interface SalesCurrencyTotal {
  currency: string;
  transaction_count: number;
  gross_amount: number;
  net_amount: number;
}

/**
 * Result of reading the tenant sales summary (KEL-58).
 *
 * Billing answers 403 to a member without `billing:read`; the card must show that
 * apart from an empty period and from a failed read, so the result is discriminated.
 */
export type TenantSalesSummaryRead =
  | { state: 'ok'; from: string; to: string; totals: SalesCurrencyTotal[] }
  | { state: 'forbidden' }
  | { state: 'error' };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
// Intl.NumberFormat throws on a malformed currency code, so it is checked before render.
const CURRENCY_CODE = /^[A-Za-z]{3}$/;

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function normalizeTotal(raw: unknown): SalesCurrencyTotal | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Record<string, unknown>;
  if (
    typeof item.currency !== 'string' ||
    !CURRENCY_CODE.test(item.currency) ||
    !isAmount(item.transaction_count) ||
    !isAmount(item.gross_amount) ||
    !isAmount(item.net_amount)
  ) {
    return null;
  }
  return {
    currency: item.currency.toUpperCase(),
    transaction_count: item.transaction_count,
    gross_amount: item.gross_amount,
    net_amount: item.net_amount,
  };
}

/**
 * Reads the paid sales of the last 30 UTC days (billing's default range).
 * Target Endpoint: GET /api/v1/billing/transactions/summary
 *
 * Never throws: every failure becomes a state so the rest of the dashboard renders.
 * A malformed total is treated as an error rather than dropped, because a partial
 * sum would show a wrong figure.
 */
export async function getTenantSalesSummary(): Promise<TenantSalesSummaryRead> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE)?.value || '';
    const tenantId = cookieStore.get(TENANT_COOKIE)?.value || '';
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (tenantId) headers['X-Tenant-ID'] = tenantId;

    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/billing/transactions/summary`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (response.status === 403) {
      return { state: 'forbidden' };
    }
    if (!response.ok) {
      console.warn('[getTenantSalesSummary] Non-OK response:', response.status);
      return { state: 'error' };
    }

    const result: unknown = await response.json();
    if (typeof result !== 'object' || result === null) return { state: 'error' };
    const envelope = result as Record<string, unknown>;
    const data = envelope.data as Record<string, unknown> | null | undefined;
    if (
      envelope.status !== 'success' ||
      typeof data !== 'object' ||
      data === null ||
      typeof data.from !== 'string' ||
      !DATE_ONLY.test(data.from) ||
      typeof data.to !== 'string' ||
      !DATE_ONLY.test(data.to) ||
      !Array.isArray(data.totals)
    ) {
      return { state: 'error' };
    }

    const totals = data.totals.map(normalizeTotal);
    if (totals.some((total) => total === null)) {
      return { state: 'error' };
    }

    return { state: 'ok', from: data.from, to: data.to, totals: totals as SalesCurrencyTotal[] };
  } catch (error) {
    console.error('[getTenantSalesSummary Error]:', error);
    return { state: 'error' };
  }
}
