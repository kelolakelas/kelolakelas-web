/**
 * Types, filter parsing, and query builders for the tenant transaction list
 * (KEL-148).
 *
 * Everything here is synchronous and side effect free so the filter parsing,
 * the list/export query builders, and the row normalisation can be unit
 * tested without a gateway or a request context. The asynchronous gateway
 * reads live in `../_queries/transactions.ts` and the CSV proxy in
 * `../export/route.ts`.
 *
 * Backend contract (billing service, proxied unchanged by the gateway):
 *
 * - `GET /api/v1/billing/transactions` (guarded by `billing:read` for tenant
 *   members) answers the paginated `{ items, pagination }` envelope. Filters
 *   are `status` (one of the values below), `search` (merchant order or
 *   payment intent substring), `date_from`/`date_to` as strict `YYYY-MM-DD`,
 *   and `date_by` (`created_at` or `paid_at`). This screen always sends
 *   `date_by=paid_at` because the tenant reconciles against the payment date
 *   (UTC-day semantics, ADR 0039).
 * - `GET /api/v1/billing/transactions/export` accepts the same filters and
 *   streams the CSV. It defaults an absent `status` to `paid`, so this screen
 *   always sends an explicit status: the list and the download can never
 *   disagree about which rows they cover. A range longer than 366 calendar
 *   days is refused with `400`.
 *
 * Row shapes mirror `domain.TransactionResponse` in the billing service: the
 * fee column is `platform_fee + payment_gateway_fee`, and `net_amount` is the
 * tenant's share after both fees.
 */

/** Canonical path of this screen, used by links and the filter form. */
export const TENANT_TRANSACTIONS_PATH = '/dashboard/tenant/transactions';

/** CSV proxy for the active filter; the gateway token stays server-side. */
export const TENANT_TRANSACTIONS_EXPORT_PATH = `${TENANT_TRANSACTIONS_PATH}/export`;

/** Rows per transaction page; matches the billing service default. */
export const TRANSACTION_PAGE_SIZE = 20;

/**
 * Every status the billing list/export endpoints accept as a filter, from
 * `domain.TransactionStatusFilterValues`. The screen offers no "all statuses"
 * option on purpose: the export endpoint defaults an absent status to `paid`,
 * so omitting it would download different rows than the list shows.
 */
export const TRANSACTION_STATUSES = [
  'pending',
  'paid',
  'failed',
  'expired',
  'cancelled',
  'refunded',
  'creating',
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Filter state this screen round-trips through the URL. */
export interface TransactionFilters {
  page: number;
  status: string;
  search: string;
  date_from: string;
  date_to: string;
}

export type TransactionFilterResult =
  | { filters: TransactionFilters; error: null }
  | { filters: null; error: 'invalid_filter' };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether `YYYY-MM-DD` names a real calendar day.
 *
 * The shape pattern alone would accept `2026-02-30`, which the backend
 * refuses; rejecting it up front keeps the member from submitting a filter
 * that cannot run.
 */
export function isValidTransactionDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const utc = new Date(Date.UTC(year, month - 1, day));

  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

/** `YYYY-MM-DD` for a UTC instant, matching the backend's UTC-day semantics. */
export function toUtcDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function firstValue(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }

  return '';
}

/**
 * Default filter: `paid` transactions over the last 30 UTC days ending today.
 *
 * The window matches the export/summary default (today and the preceding 29
 * days), so the first view already reconciles with the sales summary. `now`
 * is injectable so tests can pin the window.
 */
export function defaultTransactionFilters(now: Date = new Date()): TransactionFilters {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);

  return {
    page: 1,
    status: 'paid',
    search: '',
    date_from: toUtcDateString(from),
    date_to: toUtcDateString(to),
  };
}

/**
 * Reads the `page`, `status`, `search`, `date_from`, and `date_to` query
 * parameters into the filter state.
 *
 * Absent parameters keep the paid last-30-days defaults. A non-positive
 * `page`, an unknown `status`, a malformed date, or a `date_from` after
 * `date_to` is reported as `invalid_filter` instead of being forwarded: the
 * billing service answers each with `400`, and a filter somebody typed by
 * hand should produce an explanation rather than a failed request.
 */
export function parseTransactionFilters(
  input: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): TransactionFilterResult {
  const defaults = defaultTransactionFilters(now);
  const rawPage = firstValue(input.page).trim();
  const status = firstValue(input.status).trim();
  const search = firstValue(input.search).trim().slice(0, 255);
  const rawFrom = firstValue(input.date_from).trim();
  const rawTo = firstValue(input.date_to).trim();

  if (rawPage !== '' && !/^[1-9]\d*$/.test(rawPage)) {
    return { filters: null, error: 'invalid_filter' };
  }

  if (status !== '' && !(TRANSACTION_STATUSES as readonly string[]).includes(status)) {
    return { filters: null, error: 'invalid_filter' };
  }

  if (rawFrom !== '' && !isValidTransactionDate(rawFrom)) {
    return { filters: null, error: 'invalid_filter' };
  }

  if (rawTo !== '' && !isValidTransactionDate(rawTo)) {
    return { filters: null, error: 'invalid_filter' };
  }

  const dateFrom = rawFrom === '' ? defaults.date_from : rawFrom;
  const dateTo = rawTo === '' ? defaults.date_to : rawTo;

  if (dateFrom > dateTo) {
    return { filters: null, error: 'invalid_filter' };
  }

  return {
    filters: {
      page: rawPage === '' ? 1 : Number(rawPage),
      status: status === '' ? defaults.status : status,
      search,
      date_from: dateFrom,
      date_to: dateTo,
    },
    error: null,
  };
}

/**
 * Shared filter parameters for the list and the CSV export.
 *
 * Both readers build from this one function, so the rows on screen and the
 * downloaded file always cover the same filter. `date_by=paid_at` is always
 * sent: the backend would otherwise filter on the creation date. Dates stay
 * plain `YYYY-MM-DD` because the service parses them strictly in that layout.
 */
export function transactionFilterParams(filters: TransactionFilters): URLSearchParams {
  const params = new URLSearchParams({
    date_by: 'paid_at',
    status: filters.status,
    date_from: filters.date_from,
    date_to: filters.date_to,
  });

  if (filters.search) {
    params.set('search', filters.search);
  }

  return params;
}

/**
 * Query string for the billing transaction list.
 *
 * `page_size` is always sent so the screen never silently falls back if the
 * service default ever changes.
 */
export function transactionListQuery(filters: TransactionFilters): string {
  const params = transactionFilterParams(filters);
  params.set('page', String(filters.page));
  params.set('page_size', String(TRANSACTION_PAGE_SIZE));

  return params.toString();
}

/**
 * Query string for the CSV export covering exactly the same rows as the list.
 *
 * Pagination is intentionally omitted: the export streams the whole filtered
 * range, not one page of it.
 */
export function transactionExportQuery(filters: TransactionFilters): string {
  return transactionFilterParams(filters).toString();
}

/** Link to this screen at another page, preserving the active filters. */
export function transactionPageHref(filters: TransactionFilters): string {
  const params = new URLSearchParams();

  params.set('status', filters.status);
  params.set('date_from', filters.date_from);
  params.set('date_to', filters.date_to);

  if (filters.search) {
    params.set('search', filters.search);
  }

  params.set('page', String(filters.page));

  return `${TENANT_TRANSACTIONS_PATH}?${params.toString()}`;
}

/** Download link for the CSV covering exactly the active filters. */
export function transactionExportHref(filters: TransactionFilters): string {
  return `${TENANT_TRANSACTIONS_EXPORT_PATH}?${transactionExportQuery(filters)}`;
}

/**
 * One row of `GET /api/v1/billing/transactions`.
 *
 * Only the fields this screen renders are declared; the endpoint serialises
 * tenant/parent timestamps and fee snapshots around them.
 */
export interface TenantTransaction {
  id: string;
  merchant_order_id: string;
  status: string;
  currency: string;
  gross_amount: number;
  platform_fee: number;
  payment_gateway_fee: number;
  net_amount: number;
  paid_at: string | null;
  created_at: string;
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

// Intl.NumberFormat throws on a malformed currency code, so it is checked
// before render; a row with one is dropped like any other unusable row.
const CURRENCY_CODE = /^[A-Za-z]{3}$/;

/**
 * Normalises one raw list entry, or null when it cannot be rendered.
 *
 * Unusable rows are dropped by the caller rather than failing the list,
 * mirroring the report reader: one malformed row must not take the page down.
 */
export function normalizeTenantTransaction(raw: unknown): TenantTransaction | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const entry = raw as Record<string, unknown>;

  if (
    typeof entry.id !== 'string' ||
    entry.id === '' ||
    typeof entry.merchant_order_id !== 'string' ||
    entry.merchant_order_id === '' ||
    typeof entry.status !== 'string' ||
    typeof entry.currency !== 'string' ||
    !CURRENCY_CODE.test(entry.currency) ||
    !isAmount(entry.gross_amount) ||
    !isAmount(entry.platform_fee) ||
    !isAmount(entry.payment_gateway_fee) ||
    !isAmount(entry.net_amount) ||
    typeof entry.created_at !== 'string'
  ) {
    return null;
  }

  const paidAt = entry.paid_at;

  // A present-but-mistyped paid date means a malformed row, not an unpaid
  // one: only a string or an absent value normalises.
  if (paidAt !== undefined && paidAt !== null && typeof paidAt !== 'string') {
    return null;
  }

  return {
    id: entry.id,
    merchant_order_id: entry.merchant_order_id,
    status: entry.status,
    currency: entry.currency,
    gross_amount: entry.gross_amount,
    platform_fee: entry.platform_fee,
    payment_gateway_fee: entry.payment_gateway_fee,
    net_amount: entry.net_amount,
    paid_at: typeof paidAt === 'string' ? paidAt : null,
    created_at: entry.created_at,
  };
}

/** Total fee the tenant bears on one row: platform fee plus gateway fee. */
export function transactionFeeTotal(tx: TenantTransaction): number {
  return tx.platform_fee + tx.payment_gateway_fee;
}
