import { describe, expect, it } from 'vitest';
import {
  canCancelEnrollment,
  enrollmentCancellationErrorMessage,
  enrollmentCancellationRequestPath,
  isCancelableEnrollmentId,
} from './enrollment-cancellation';

/**
 * The cancel predicate mirrors the refusal table in ADR 0016, so these cases
 * are the table's rows rather than arbitrary inputs: offering the action where
 * the backend would refuse it is the failure this pins.
 */
describe('canCancelEnrollment', () => {
  it('offers cancellation for a pending enrollment with no transaction yet', () => {
    expect(canCancelEnrollment({ status: 'pending' })).toBe(true);
    expect(canCancelEnrollment({ status: 'pending' }, null)).toBe(true);
  });

  it('offers cancellation while the invoice is still payable', () => {
    for (const status of ['pending', 'creating', 'failed', 'expired', 'cancelled']) {
      expect(canCancelEnrollment({ status: 'pending' }, { status })).toBe(true);
    }
  });

  it('never offers cancellation once the invoice was settled', () => {
    // A paid transaction leaves the enrollment `pending` until activation is
    // applied, so the enrollment status alone is not enough to decide.
    expect(canCancelEnrollment({ status: 'pending' }, { status: 'paid' })).toBe(false);
    expect(canCancelEnrollment({ status: 'pending' }, { status: 'refunded' })).toBe(false);
  });

  it('never offers cancellation for an enrollment that already started or finished', () => {
    for (const status of ['active', 'completed', 'dropped']) {
      expect(canCancelEnrollment({ status }, { status: 'pending' })).toBe(false);
      expect(canCancelEnrollment({ status })).toBe(false);
    }
  });
});

describe('enrollmentCancellationRequestPath', () => {
  it('posts to the academic cancellation sub-resource through the gateway', () => {
    expect(enrollmentCancellationRequestPath('abc-123')).toBe('/api/v1/enrollments/abc-123/cancel');
  });
});

describe('isCancelableEnrollmentId', () => {
  it('accepts a UUID and rejects anything the endpoint would refuse', () => {
    expect(isCancelableEnrollmentId('3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11')).toBe(true);
    expect(isCancelableEnrollmentId('3B1F0C9A-4A7E-4C1D-9C4E-6F2B0D8A5E11')).toBe(true);
    expect(isCancelableEnrollmentId('')).toBe(false);
    expect(isCancelableEnrollmentId('not-a-uuid')).toBe(false);
    expect(isCancelableEnrollmentId("' OR 1=1 --")).toBe(false);
  });
});

describe('enrollmentCancellationErrorMessage', () => {
  it('explains a refusal that no retry can fix', () => {
    expect(enrollmentCancellationErrorMessage(409)).toContain('tidak dapat dibatalkan');
    expect(enrollmentCancellationErrorMessage(409)).toContain('Muat ulang halaman');
    expect(enrollmentCancellationErrorMessage(404)).toContain('tidak ditemukan');
  });

  it('separates an expired session from a caller that is not a parent', () => {
    expect(enrollmentCancellationErrorMessage(401)).toContain('Sesi Anda sudah berakhir');
    expect(enrollmentCancellationErrorMessage(403)).toContain('Hanya akun parent');
  });

  it('names an unavailable authorization service and a rejection of the request shape', () => {
    expect(enrollmentCancellationErrorMessage(503)).toContain('Layanan otorisasi');
    expect(enrollmentCancellationErrorMessage(400)).toContain('tidak valid');
  });

  it('never surfaces the raw server error text to a parent', () => {
    // The academic handler answers 500 with the Go error string, which can name
    // internal repositories and database errors.
    const message = enrollmentCancellationErrorMessage(
      500,
      'failed to fetch enrollment: dial tcp 10.0.0.5:5432: connect: connection refused'
    );

    expect(message).not.toContain('10.0.0.5');
    expect(message).not.toContain('failed to fetch enrollment');
    expect(message).toContain('Coba lagi nanti');
  });

  it("keeps the backend's own message when it explains a 4xx that has no mapping", () => {
    expect(enrollmentCancellationErrorMessage(422, 'enrollment is not cancellable')).toBe(
      'enrollment is not cancellable'
    );
    expect(enrollmentCancellationErrorMessage(422, '   ')).toContain('Coba lagi nanti');
  });
});
