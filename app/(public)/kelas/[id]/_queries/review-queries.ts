import { getGatewayBaseUrl, withGatewayClientIp } from '@/lib/gateway';
import { normalizeListEnvelope } from '@/lib/list-envelope';
import { isValidReviewItem, REVIEW_PAGE_SIZE, type ReviewList, type ReviewResult } from '@/lib/reviews';

/**
 * Public class-review list (KEL-160), following the `getCatalog` pattern: the
 * gateway origin comes from server configuration, the client IP is forwarded
 * when configured, and a malformed payload is an `api` error — never a valid
 * empty list.
 *
 * Server-only: imports the gateway helper (which reads `next/headers`), so
 * client components must never import this module. The pure validation,
 * payload, and formatting helpers live in `lib/reviews.ts`.
 */
export async function getClassReviews(classId: string, page = 1): Promise<ReviewResult<ReviewList>> {
  if (!Number.isInteger(page) || page < 1) return { error: 'invalid' };
  try {
    const response = await fetch(
      `${getGatewayBaseUrl()}/api/v1/catalog/classes/${encodeURIComponent(classId)}/reviews?page=${page}&page_size=${REVIEW_PAGE_SIZE}`,
      { headers: await withGatewayClientIp({ Accept: 'application/json' }), cache: 'no-store' }
    );
    if (response.status === 404) return { error: 'not_found' };
    if (response.status === 400 || response.status === 422) return { error: 'invalid' };
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.status !== 'success' || !body.data) return { error: 'api' };
    const envelope = normalizeListEnvelope<unknown>(body.data);
    if (!Array.isArray((body.data as { items?: unknown }).items)) return { error: 'api' };
    if (!envelope.items.every(isValidReviewItem)) return { error: 'api' };
    return { data: { items: envelope.items, pagination: envelope.pagination } };
  } catch {
    return { error: 'api' };
  }
}
