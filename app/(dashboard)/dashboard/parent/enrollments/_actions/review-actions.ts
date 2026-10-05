'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { getSessionIdentityFromToken } from '@/lib/auth-session';
import {
  INVALID_REVIEW_ENROLLMENT_ID_MESSAGE,
  INVALID_REVIEW_RATING_MESSAGE,
  isReviewEnrollmentId,
  isValidReviewComment,
  isValidReviewRating,
  REVIEW_COMMENT_TOO_LONG_MESSAGE,
  REVIEW_PARENT_SESSION_MESSAGE,
  REVIEW_SUCCESS_MESSAGE,
  reviewActionErrorMessage,
  reviewPayload,
  reviewRequestPath,
  type ReviewActionState,
} from '@/lib/reviews';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

/**
 * Creates or replaces the signed-in parent's review for one enrollment (KEL-160).
 *
 * The academic service owns every decision: it resolves the enrollment through
 * the caller's parent id (`domain.ErrReviewNotEligible` answers 404), so a
 * foreign enrollment is reported exactly like an id that never existed, and it
 * validates rating 1-5 plus the 2000-rune comment cap. This action therefore
 * forwards only the enrollment id from the URL path plus the exact
 * `domain.ReviewRequest` body — the browser never supplies a parent id, a
 * status, or a class id — and reports whatever the backend decided.
 *
 * Client-side validation mirrors the backend so an obvious mistake never
 * reaches the network, but the backend stays authoritative: a `400` from an
 * older or newer rule is still reported rather than assumed impossible.
 *
 * A successful save revalidates the enrollment screen so the row reflects the
 * stored state rather than an optimistic local guess.
 */
export async function saveEnrollmentReview(
  _previous: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const enrollmentId = formData.get('enrollment_id')?.toString().trim() || '';
  if (!isReviewEnrollmentId(enrollmentId)) {
    return { status: 'error', message: INVALID_REVIEW_ENROLLMENT_ID_MESSAGE };
  }

  const rawRating = formData.get('rating')?.toString().trim() || '';
  const rating = rawRating === '' ? NaN : Number(rawRating);
  if (!isValidReviewRating(rating)) {
    return { status: 'error', message: INVALID_REVIEW_RATING_MESSAGE };
  }

  const comment = formData.get('comment')?.toString() ?? '';
  if (!isValidReviewComment(comment)) {
    return { status: 'error', message: REVIEW_COMMENT_TOO_LONG_MESSAGE };
  }

  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    const identity = getSessionIdentityFromToken(token);
    if (!identity || !identity.isParent) {
      return { status: 'error', message: REVIEW_PARENT_SESSION_MESSAGE };
    }

    const response = await fetch(
      `${getGatewayBaseUrl()}${reviewRequestPath(enrollmentId)}`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(reviewPayload(rating, comment)),
        cache: 'no-store',
      }
    );
    const result = (await response.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
    };

    if (!response.ok || result.status !== 'success') {
      return {
        status: 'error',
        message: reviewActionErrorMessage(
          response.status,
          typeof result.message === 'string' ? result.message : null
        ),
      };
    }

    revalidatePath('/dashboard/parent/enrollments');
    return { status: 'success', message: REVIEW_SUCCESS_MESSAGE };
  } catch (error) {
    return {
      status: 'error',
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'Layanan ulasan sedang tidak tersedia. Coba lagi nanti.',
    };
  }
}
