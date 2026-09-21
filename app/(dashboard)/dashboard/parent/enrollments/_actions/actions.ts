'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { getSessionIdentityFromToken } from '@/lib/auth-session';
import {
  ENROLLMENT_CANCELLATION_PATH,
  ENROLLMENT_CANCELLATION_SUCCESS_MESSAGE,
  INVALID_ENROLLMENT_ID_MESSAGE,
  PARENT_SESSION_MESSAGE,
  enrollmentCancellationErrorMessage,
  enrollmentCancellationRequestPath,
  isCancelableEnrollmentId,
  type EnrollmentCancellationState,
} from '@/lib/enrollment-cancellation';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

/**
 * Cancels one of the signed-in parent's own pending enrollments (KEL-45).
 *
 * The academic service owns the decision: it resolves the enrollment through
 * the caller's parent id, so another parent's enrollment answers 404, and it
 * withdraws the invoice before dropping the seat ([ADR 0016]). This action
 * therefore forwards only the enrollment id taken from the session — the
 * browser never supplies a parent id or a status — and reports whatever the
 * backend decided. A successful cancellation revalidates the screen so the row
 * shows the `dropped` state the backend stored rather than an optimistic local
 * guess.
 *
 * [ADR 0016]: https://github.com/kelolakelas/kelolakelas-docs/blob/main/docs/adr/0016-cancel-pending-enrollment.md
 */
export async function cancelPendingEnrollment(
  _previous: EnrollmentCancellationState,
  formData: FormData
): Promise<EnrollmentCancellationState> {
  const enrollmentId = formData.get('enrollment_id')?.toString().trim() || '';
  if (!isCancelableEnrollmentId(enrollmentId)) {
    return { status: 'error', message: INVALID_ENROLLMENT_ID_MESSAGE };
  }

  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    const identity = getSessionIdentityFromToken(token);
    if (!identity || !identity.isParent) {
      return { status: 'error', message: PARENT_SESSION_MESSAGE };
    }

    const response = await fetch(
      `${getGatewayBaseUrl()}${enrollmentCancellationRequestPath(enrollmentId)}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
        message: enrollmentCancellationErrorMessage(response.status, result.message),
      };
    }

    revalidatePath(ENROLLMENT_CANCELLATION_PATH);
    return { status: 'success', message: ENROLLMENT_CANCELLATION_SUCCESS_MESSAGE };
  } catch (error) {
    return {
      status: 'error',
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'Layanan pembatalan enrollment sedang tidak tersedia. Coba lagi nanti.',
    };
  }
}
