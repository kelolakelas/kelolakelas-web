/**
 * Pure helpers for the tenant member list (KEL-74).
 *
 * Everything here is synchronous and side effect free so the page parameter
 * parsing and the pagination links can be unit tested without a gateway or a
 * request context. The asynchronous gateway read lives in
 * `../_queries/queries.ts`.
 *
 * `GET /api/v1/members` (identity) answers the paginated
 * `{ items, pagination }` envelope and accepts `page` and `page_size`, which
 * the API gateway proxies through unchanged like every other list endpoint.
 */

/** Canonical path of this screen, used by the pagination links. */
export const TENANT_MEMBERS_PATH = '/dashboard/tenant/members';

/**
 * Rows per members page.
 *
 * 20 matches the identity service default, so sending it explicitly pins the
 * page size the screen was designed for instead of silently following the
 * service default if that ever changes.
 */
export const MEMBER_PAGE_SIZE = 20;

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
 * Reads the `page` query parameter into the page requested from identity.
 *
 * The member list has no other filter, so unlike the enrollment screen there
 * is no invalid-filter state to explain: a value that is not a positive
 * integer falls back to the first page, which is the contract's answer for a
 * page outside the valid range. An absent or empty parameter keeps the
 * default, so a plain `/members` visit parses cleanly.
 */
export function parseMemberPage(
  input: Record<string, string | string[] | undefined>
): number {
  const rawPage = firstValue(input.page).trim();

  const page = Number(rawPage);

  return /^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(page) ? page : 1;
}

/**
 * Query string for the identity member list.
 *
 * `page_size` is always sent so the screen never silently falls back to the
 * service default of 20 rows if that default ever changes.
 */
export function membersQueryString(page: number): string {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(MEMBER_PAGE_SIZE),
  });

  return params.toString();
}

/**
 * Link to this screen at another page.
 *
 * `page=1` is omitted so the canonical first page stays a clean URL.
 */
export function memberPageHref(page: number): string {
  return page > 1 ? `${TENANT_MEMBERS_PATH}?page=${page}` : TENANT_MEMBERS_PATH;
}
