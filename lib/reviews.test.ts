import { describe, expect, it } from 'vitest';
import {
  canReviewEnrollment,
  formatRatingAverage,
  formatReviewDate,
  isReviewEnrollmentId,
  isValidReviewComment,
  isValidReviewRating,
  MAX_REVIEW_COMMENT_LENGTH,
  reviewActionErrorMessage,
  reviewCommentLength,
  reviewPayload,
  reviewRequestPath,
} from './reviews';

describe('review validation helpers', () => {
  it('accepts only ratings 1-5 as integers', () => {
    expect(isValidReviewRating(1)).toBe(true);
    expect(isValidReviewRating(5)).toBe(true);
    for (const invalid of [0, 6, 2.5, NaN, '5', null, undefined]) {
      expect(isValidReviewRating(invalid)).toBe(false);
    }
  });

  it('counts comment length in runes like the backend utf8 check', () => {
    expect(reviewCommentLength('halo')).toBe(4);
    // One emoji is one Go rune but two UTF-16 units: maxLength-style counting
    // would reject it early, rune counting matches the backend.
    expect(reviewCommentLength('👍')).toBe(1);
    expect(isValidReviewComment('a'.repeat(MAX_REVIEW_COMMENT_LENGTH))).toBe(true);
    expect(isValidReviewComment('a'.repeat(MAX_REVIEW_COMMENT_LENGTH + 1))).toBe(false);
    expect(isValidReviewComment('👍'.repeat(MAX_REVIEW_COMMENT_LENGTH))).toBe(true);
    expect(isValidReviewComment('👍'.repeat(MAX_REVIEW_COMMENT_LENGTH + 1))).toBe(false);
  });

  it('builds the exact backend ReviewRequest body with nothing else', () => {
    expect(reviewPayload(4, 'Bagus')).toEqual({ rating: 4, comment: 'Bagus' });
    expect(reviewRequestPath('enrollment-1')).toBe('/api/v1/enrollments/enrollment-1/review');
  });

  it('accepts only the identifier shape the academic endpoint parses as a UUID', () => {
    expect(isReviewEnrollmentId('3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11')).toBe(true);
    expect(isReviewEnrollmentId('not-a-uuid')).toBe(false);
  });

  it('offers the form only for the statuses the backend accepts', () => {
    expect(canReviewEnrollment({ status: 'active' })).toBe(true);
    expect(canReviewEnrollment({ status: 'completed' })).toBe(true);
    for (const status of ['pending', 'dropped', 'suspended', '']) {
      expect(canReviewEnrollment({ status })).toBe(false);
    }
  });

  it('formats the average with an Indonesian decimal separator', () => {
    expect(formatRatingAverage(4.5)).toBe('4,5');
    expect(formatRatingAverage(5)).toBe('5,0');
  });

  it('formats backend timestamps in Indonesian and rejects garbage', () => {
    expect(formatReviewDate('2026-09-20T10:00:00Z')).toContain('2026');
    expect(formatReviewDate('not-a-date')).toBeNull();
  });

  it('maps a refused save onto actionable parent copy without raw server text', () => {
    expect(reviewActionErrorMessage(404)).toContain('belum memenuhi syarat');
    expect(reviewActionErrorMessage(400)).toContain('tidak valid');
    expect(reviewActionErrorMessage(401)).toContain('masuk kembali');
    expect(reviewActionErrorMessage(403)).toContain('Hanya akun parent');
    expect(reviewActionErrorMessage(500, 'ERROR: deadlock detected (SQLSTATE 40P01)')).not.toContain('SQLSTATE');
  });
});
