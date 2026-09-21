import { describe, expect, it } from 'vitest';
import type { TransactionRecord } from '@/lib/payment-status';
import {
  enrollmentPageHref,
  enrollmentQueryString,
  enrollmentStatusLabel,
  parseEnrollmentFilters,
  pickEnrollmentTransaction,
  scheduleLabel,
  schedulesById,
  studentDisplayName,
  transactionAmountLabel,
  transactionQueryString,
} from './schema';

/**
 * These cases pin the contract of the tenant enrollment overview (KEL-33) to
 * the backend endpoints it reads.
 *
 * Both vocabularies are copied from the services rather than invented here:
 * `GET /api/v1/enrollments` accepts only `pending|active|completed|dropped`
 * (anything else is `400 invalid enrollment status`), and
 * `GET /api/v1/billing/transactions` accepts `page`, `page_size`, and a single
 * UUID `enrollment_id`. A regression in this module either fails a legitimate
 * filter, forwards a value the backend rejects, or shows a tenant a payment
 * state that does not belong to the enrollment.
 */

const enrollmentId = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';

function transaction(overrides: Partial<TransactionRecord> = {}): TransactionRecord {
  return { id: 'transaction-1', enrollment_id: enrollmentId, status: 'pending', ...overrides };
}

describe('parseEnrollmentFilters', () => {
  it('defaults to the first page with no status filter', () => {
    expect(parseEnrollmentFilters({})).toEqual({
      filters: { page: 1, status: '' },
      error: null,
    });
  });

  it('accepts every status the academic service accepts', () => {
    for (const status of ['pending', 'active', 'completed', 'dropped'] as const) {
      expect(parseEnrollmentFilters({ status })).toEqual({
        filters: { page: 1, status },
        error: null,
      });
    }
  });

  it('rejects a status outside the backend vocabulary', () => {
    // `open` is a *class* enrollment status, not an enrollment record status,
    // so it must not be forwarded to an endpoint that answers 400 for it.
    for (const status of ['open', 'closed', 'archived', 'ACTIVE', 'deleted']) {
      expect(parseEnrollmentFilters({ status })).toEqual({
        filters: null,
        error: 'invalid_filter',
      });
    }
  });

  it('rejects a page that is not a positive integer', () => {
    for (const page of ['0', '-1', '1.5', 'two', '1e2']) {
      expect(parseEnrollmentFilters({ page })).toEqual({
        filters: null,
        error: 'invalid_filter',
      });
    }
  });

  it('reads the first value when a parameter is repeated', () => {
    expect(parseEnrollmentFilters({ page: ['2', '3'], status: ['active', 'dropped'] })).toEqual({
      filters: { page: 2, status: 'active' },
      error: null,
    });
  });

  it('treats an explicitly empty status as no filter', () => {
    // The filter form always submits `status`, so an empty value has to mean
    // "all statuses" rather than "invalid".
    expect(parseEnrollmentFilters({ status: '', page: '2' })).toEqual({
      filters: { page: 2, status: '' },
      error: null,
    });
  });
});

describe('enrollmentQueryString', () => {
  it('always sends the page size so the service default is never used', () => {
    const query = new URLSearchParams(enrollmentQueryString({ page: 1, status: '' }));

    expect(query.get('page')).toBe('1');
    expect(query.get('page_size')).toBe('20');
    expect(query.has('status')).toBe(false);
  });

  it('forwards only the accepted status values', () => {
    const query = new URLSearchParams(enrollmentQueryString({ page: 3, status: 'active' }));

    expect(query.get('page')).toBe('3');
    expect(query.get('status')).toBe('active');
  });
});

describe('transactionQueryString', () => {
  it('asks for the newest transaction of exactly one enrollment', () => {
    const query = new URLSearchParams(transactionQueryString(enrollmentId));

    expect(query.get('enrollment_id')).toBe(enrollmentId);
    expect(query.get('page_size')).toBe('1');
    expect(query.get('page')).toBe('1');
  });
});

describe('enrollmentPageHref', () => {
  it('keeps the canonical first page free of a page parameter', () => {
    expect(enrollmentPageHref(1, { page: 1, status: '' })).toBe(
      '/dashboard/tenant/enrollments'
    );
  });

  it('carries the active status filter across pages', () => {
    expect(enrollmentPageHref(2, { page: 1, status: 'dropped' })).toBe(
      '/dashboard/tenant/enrollments?status=dropped&page=2'
    );
  });
});

describe('pickEnrollmentTransaction', () => {
  it('returns nothing when the enrollment has no transaction at all', () => {
    // An enrollment is created before billing is called, so an invoice whose
    // creation failed leaves exactly this state.
    expect(pickEnrollmentTransaction([])).toBeUndefined();
  });

  it('keeps the newest row when renewals produced several transactions', () => {
    const newest = transaction({ id: 'transaction-newest', reconciliation_status: 'reconciling' });
    const older = transaction({ id: 'transaction-older', status: 'paid' });

    expect(pickEnrollmentTransaction([newest, older])?.id).toBe('transaction-newest');
  });
});

describe('studentDisplayName', () => {
  it('reads the last name from the key the academic service actually serialises', () => {
    expect(studentDisplayName({ first_name: 'Ayu', ['lastå_name']: 'Lestari' })).toBe('Ayu Lestari');
  });

  it('prefers the corrected key when a payload carries both', () => {
    expect(
      studentDisplayName({ first_name: 'Ayu', last_name: 'Lestari', ['lastå_name']: 'Salah' })
    ).toBe('Ayu Lestari');
  });

  it('falls back to a placeholder instead of rendering an empty cell', () => {
    expect(studentDisplayName(null)).toBe('Student');
    expect(studentDisplayName({ first_name: '   ' })).toBe('Student');
  });
});

describe('scheduleLabel', () => {
  it('formats the weekly slot the same way the public catalog does', () => {
    expect(
      scheduleLabel({ id: 'schedule-1', day_of_week: 3, start_time: '15:30:00', end_time: '17:00:00' })
    ).toBe('Rabu, 15:30–17:00');
  });

  it('includes the location when the schedule carries one', () => {
    expect(
      scheduleLabel({
        id: 'schedule-1',
        day_of_week: 1,
        start_time: '08:00:00',
        end_time: '09:00:00',
        location: 'Ruang 2',
      })
    ).toBe('Senin, 08:00–09:00 · Ruang 2');
  });

  it('returns nothing for a missing or incomplete schedule', () => {
    // Private enrollments have no schedule id and a schedule may fall outside
    // the fetched window, so both must be a null label rather than a crash.
    expect(scheduleLabel(undefined)).toBeNull();
    expect(scheduleLabel({ id: 'schedule-1', day_of_week: 3 })).toBeNull();
    expect(scheduleLabel({ id: 'schedule-1', day_of_week: 9, start_time: '08:00', end_time: '09:00' })).toBeNull();
  });
});

describe('schedulesById', () => {
  it('indexes schedules by id and skips entries without one', () => {
    const index = schedulesById([
      { id: 'schedule-1', day_of_week: 1, start_time: '08:00:00', end_time: '09:00:00' },
      { id: '', day_of_week: 2, start_time: '08:00:00', end_time: '09:00:00' },
    ]);

    expect(index.size).toBe(1);
    expect(index.get('schedule-1')?.day_of_week).toBe(1);
  });
});

describe('transactionAmountLabel', () => {
  it('formats the gross amount in rupiah', () => {
    expect(transactionAmountLabel(transaction({ gross_amount: 1500000 }))).toContain('1.500.000');
  });

  it('explains the missing amount instead of rendering zero', () => {
    expect(transactionAmountLabel(undefined)).toBe('Nominal belum tersedia');
    expect(transactionAmountLabel(transaction())).toBe('Nominal belum tersedia');
  });
});

describe('enrollmentStatusLabel', () => {
  it('translates the statuses the academic service emits', () => {
    expect(enrollmentStatusLabel('pending')).toBe('Menunggu aktivasi');
    expect(enrollmentStatusLabel('active')).toBe('Aktif');
    expect(enrollmentStatusLabel('completed')).toBe('Selesai');
    expect(enrollmentStatusLabel('dropped')).toBe('Dibatalkan');
  });

  it('shows an unknown status verbatim rather than hiding the row state', () => {
    // A future backend status must remain visible and uncoloured instead of
    // being rendered as a blank badge.
    expect(enrollmentStatusLabel('waitlisted')).toBe('waitlisted');
  });
});
