/**
 * Parent class-review contract (KEL-160).
 *
 * This module is deliberately dependency-free (no `next/headers`, no gateway
 * helper) so the client-side `ReviewForm` can import the validation, payload,
 * and formatting helpers without pulling server-only APIs into the browser
 * bundle. The server-side list fetch lives in
 * `app/(public)/kelas/[id]/_queries/review-queries.ts`, following the repo's
 * `lib` (pure) + `_queries` (fetch) split.
 *
 * The academic service owns every rule. This module only mirrors what the
 * backend already enforces so the web layer sends a matching payload and
 * reports refusals in words a parent can act on:
 *
 * - `PUT /api/v1/enrollments/:id/review` with body
 *   `domain.ReviewRequest` (`{"rating":n,"comment":"..."}`), rating 1-5 and
 *   comment at most `domain.MaxReviewCommentLength` (2000) utf-8 runes.
 *   Only an `active` or `completed` enrollment owned by the caller is
 *   eligible; anything else answers 404 (`domain.ErrReviewNotEligible`).
 * - `GET /api/v1/catalog/classes/:id/reviews` (public) answers a
 *   `domain.ReviewListResponse` (`{items, pagination}`) proxied through the
 *   gateway unchanged. `PublicReview` deliberately carries no enrollment,
 *   student, or parent identifier, so the web layer cannot prefill or match
 *   "my review" from it.
 * - The class detail (but not the class list) also carries
 *   `rating_average`/`rating_count`; see `CatalogItem`.
 */

export const MAX_REVIEW_COMMENT_LENGTH = 2000;
export const MIN_REVIEW_RATING = 1;
export const MAX_REVIEW_RATING = 5;
export const REVIEW_PAGE_SIZE = 10;

/** Enrollment statuses the backend accepts a review for (review_repository.go). */
export const REVIEWABLE_ENROLLMENT_STATUSES: readonly string[] = ['active', 'completed'];

export type PublicReview = {
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type ReviewList = {
  items: PublicReview[];
  pagination: { page: number; page_size: number; total_items: number; total_pages: number };
};

export type ReviewResult<T> = { data: T; error?: never } | { data?: never; error: 'invalid' | 'not_found' | 'api' };

export type ReviewActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

export const EMPTY_REVIEW_STATE: ReviewActionState = { status: 'idle', message: '' };

export const REVIEW_SUCCESS_MESSAGE = 'Ulasan tersimpan. Terima kasih atas penilaian Anda.';

export const INVALID_REVIEW_ENROLLMENT_ID_MESSAGE = 'ID enrollment tidak valid.';

export const REVIEW_PARENT_SESSION_MESSAGE =
  'Sesi parent tidak valid. Silakan login kembali untuk menulis ulasan.';

export const INVALID_REVIEW_RATING_MESSAGE = 'Pilih rating 1–5 bintang.';

export const REVIEW_COMMENT_TOO_LONG_MESSAGE = `Komentar maksimal ${MAX_REVIEW_COMMENT_LENGTH} karakter.`;

const REVIEW_INELIGIBLE_MESSAGE =
  'Enrollment ini belum memenuhi syarat untuk diulas. Ulasan hanya tersedia untuk enrollment yang aktif atau sudah selesai.';

const REVIEW_INVALID_REQUEST_MESSAGE =
  'Permintaan ulasan tidak valid. Periksa rating dan komentar lalu coba lagi.';

const REVIEW_SESSION_EXPIRED_MESSAGE =
  'Sesi Anda sudah berakhir. Silakan masuk kembali untuk menulis ulasan.';

const REVIEW_PARENT_ONLY_MESSAGE = 'Hanya akun parent yang dapat menulis ulasan untuk enrollmentnya sendiri.';

const REVIEW_AUTH_UNAVAILABLE_MESSAGE =
  'Layanan otorisasi sedang tidak tersedia, sehingga ulasan belum dapat disimpan. Coba lagi sebentar lagi.';

const REVIEW_FALLBACK_MESSAGE = 'Ulasan belum dapat disimpan. Coba lagi nanti.';

/** Identifier shape the academic review endpoint parses as a UUID. */
export function isReviewEnrollmentId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isValidReviewRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_REVIEW_RATING &&
    value <= MAX_REVIEW_RATING
  );
}

/**
 * Rune count of a comment, matching the backend's `utf8.RuneCountInString`
 * check. Spread counts code points, which equals Go runes.
 */
export function reviewCommentLength(comment: string): number {
  return [...comment].length;
}

export function isValidReviewComment(comment: unknown): comment is string {
  return typeof comment === 'string' && reviewCommentLength(comment) <= MAX_REVIEW_COMMENT_LENGTH;
}

/**
 * Exact body the academic upsert endpoint binds (`domain.ReviewRequest`).
 * No parent id, no enrollment id, no status: the enrollment is identified by
 * the URL path and the parent by the verified session, exactly like the
 * cancellation action.
 */
export function reviewPayload(rating: number, comment: string): { rating: number; comment: string } {
  return { rating, comment };
}

/** Path the gateway proxies to the academic review upsert endpoint. */
export function reviewRequestPath(enrollmentId: string): string {
  return `/api/v1/enrollments/${enrollmentId}/review`;
}

/**
 * Whether the review form may be offered for an enrollment.
 *
 * Mirrors the backend eligibility (`status IN ('active', 'completed')`):
 * offering the form elsewhere would only produce a 404 the parent cannot
 * resolve. Ownership itself stays a backend decision.
 */
export function canReviewEnrollment(enrollment: { status: string }): boolean {
  return REVIEWABLE_ENROLLMENT_STATUSES.includes(enrollment.status);
}

/** One-decimal Indonesian formatting of the backend `rating_average`. */
export function formatRatingAverage(average: number): string {
  return average.toFixed(1).replace('.', ',');
}

/** Stable Indonesian date for a backend timestamp, or null when unparseable. */
export function formatReviewDate(value: string): string | null {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(time));
}

/**
 * Maps a refused review save onto what the parent is told.
 *
 * `404` is the interesting state: it means the backend found no eligible
 * enrollment (foreign enrollment, or a status outside active/completed),
 * which has a different next step from an outage. Server errors are
 * deliberately replaced rather than passed through, because the academic
 * handler answers a `500` with the raw Go error text.
 */
export function reviewActionErrorMessage(status: number, backendMessage?: string | null): string {
  if (status === 401) return REVIEW_SESSION_EXPIRED_MESSAGE;
  if (status === 403) return REVIEW_PARENT_ONLY_MESSAGE;
  if (status === 404) return REVIEW_INELIGIBLE_MESSAGE;
  if (status === 400) return REVIEW_INVALID_REQUEST_MESSAGE;
  if (status === 503) return REVIEW_AUTH_UNAVAILABLE_MESSAGE;
  if (status >= 500) return REVIEW_FALLBACK_MESSAGE;

  const trimmed = backendMessage?.trim();
  return trimmed ? trimmed : REVIEW_FALLBACK_MESSAGE;
}

function isValidReviewItem(item: unknown): item is PublicReview {
  if (!item || typeof item !== 'object') return false;
  const review = item as Record<string, unknown>;
  return (
    isValidReviewRating(review.rating) &&
    typeof review.comment === 'string' &&
    typeof review.created_at === 'string' &&
    typeof review.updated_at === 'string'
  );
}

export { isValidReviewItem };
