'use client';

import { useActionState, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveEnrollmentReview } from '../_actions/review-actions';
import {
  EMPTY_REVIEW_STATE,
  MAX_REVIEW_COMMENT_LENGTH,
  MAX_REVIEW_RATING,
  MIN_REVIEW_RATING,
  reviewCommentLength,
  type ReviewActionState,
} from '@/lib/reviews';

/**
 * Review form for one eligible parent enrollment (KEL-160).
 *
 * The rating control is a native radio group — one real `<input
 * type="radio">` per star — so keyboard operation (Tab to enter, arrows to
 * move, Space/number to select) and screen-reader announcements come from the
 * platform rather than from reimplemented key handlers. The group is wrapped
 * in a `<fieldset>` with a visible `<legend>` and each input carries an
 * Indonesian `aria-label` ("1 bintang" … "5 bintang"), so the purpose and the
 * current value are announced without any custom ARIA.
 *
 * Validation mirrors the backend before anything reaches the network (rating
 * required, comment within the backend rune cap) and the action reports the
 * backend's own refusal afterwards. The form posts through the Server Action
 * like the cancellation control, so no client-side fetch or token handling is
 * involved.
 */

const initialState: ReviewActionState = EMPTY_REVIEW_STATE;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 rounded-xl bg-[#617c35] px-5 py-3 text-sm font-bold text-white hover:bg-[#54682d] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Menyimpan…' : 'Simpan ulasan'}
    </button>
  );
}

export function ReviewForm({ enrollmentId, className }: { enrollmentId: string; className?: string }) {
  const [state, formAction] = useActionState(saveEnrollmentReview, initialState);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);
  const ratingGroupId = useId();
  const errorId = `${ratingGroupId}-error`;
  const commentId = `${ratingGroupId}-comment`;
  const commentLength = reviewCommentLength(comment);
  const commentTooLong = commentLength > MAX_REVIEW_COMMENT_LENGTH;

  const showError = clientError ?? (state.status === 'error' ? state.message : null);

  return (
    <form
      action={(formData) => {
        if (rating < MIN_REVIEW_RATING || rating > MAX_REVIEW_RATING) {
          setClientError('Pilih rating 1–5 bintang.');
          return;
        }
        if (commentTooLong) {
          setClientError(`Komentar maksimal ${MAX_REVIEW_COMMENT_LENGTH} karakter.`);
          return;
        }
        setClientError(null);
        formAction(formData);
      }}
      aria-label={`Ulasan untuk ${className || 'kelas ini'}`}
      className="mt-5 border-t border-[#edf0e9] pt-4"
    >
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <fieldset>
        <legend className="text-sm font-bold">Rating Anda</legend>
        <div className="mt-2 flex items-center gap-1" role="presentation">
          {[1, 2, 3, 4, 5].map((star) => (
            <label
              key={star}
              className="cursor-pointer rounded-lg p-1 text-3xl leading-none focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#617c35]"
            >
              <input
                type="radio"
                name="rating"
                value={star}
                checked={rating === star}
                onChange={() => setRating(star)}
                aria-label={`${star} bintang`}
                className="sr-only"
              />
              <span aria-hidden="true" className={star <= rating ? 'text-[#b7791f]' : 'text-[#c8d0c5]'}>
                ★
              </span>
            </label>
          ))}
          <span aria-hidden="true" className="ml-2 text-sm text-[#65726c]">
            {rating > 0 ? `${rating}/5` : 'Belum ada rating'}
          </span>
        </div>
      </fieldset>
      <div className="mt-4">
        <label htmlFor={commentId} className="text-sm font-bold">
          Komentar <span className="font-normal text-[#65726c]">(opsional)</span>
        </label>
        <textarea
          id={commentId}
          name="comment"
          rows={3}
          maxLength={MAX_REVIEW_COMMENT_LENGTH * 4}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          aria-invalid={commentTooLong}
          aria-describedby={showError ? errorId : undefined}
          placeholder="Ceritakan pengalaman belajar di kelas ini…"
          className="mt-2 min-h-20 w-full rounded-xl border border-[#c8d0c5] px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-[#65726c]">
          {commentLength}/{MAX_REVIEW_COMMENT_LENGTH} karakter
        </p>
      </div>
      {showError && (
        <p id={errorId} role="alert" className="mt-3 text-sm text-[#b42318]">
          {showError}
        </p>
      )}
      {state.status === 'success' && (
        <p role="status" className="mt-3 text-sm font-semibold text-[#356318]">
          {state.message}
        </p>
      )}
      <div className="mt-4">
        <SubmitButton />
      </div>
    </form>
  );
}
