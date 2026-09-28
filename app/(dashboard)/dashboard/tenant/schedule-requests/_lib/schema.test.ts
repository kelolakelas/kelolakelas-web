import { describe, expect, it } from 'vitest';
import {
  classesById,
  DEFAULT_SCHEDULE_REQUEST_FILTERS,
  parseScheduleRequestFilters,
  scheduleRequestBillingCycleLabel,
  scheduleRequestClassName,
  scheduleRequestCountLabel,
  scheduleRequestPageHref,
  scheduleRequestQueryString,
  scheduleRequestStudentName,
  submittedAtLabel,
  TENANT_SCHEDULE_REQUESTS_PATH,
} from './schema';

/**
 * Contract tests for the tenant schedule-request review screen helpers
 * (KEL-110).
 *
 * Everything here is synchronous and side effect free. The cases pin the
 * vocabulary the academic service accepts (`GET /api/v1/schedule-requests`
 * answers `400` for anything outside `pending|approved|rejected|cancelled`),
 * the pending work queue default, and the neutral placeholders the table
 * shows when a lookup row is missing.
 */

describe('parseScheduleRequestFilters', () => {
  it('defaults to the pending work queue', () => {
    expect(parseScheduleRequestFilters({})).toEqual({
      filters: { ...DEFAULT_SCHEDULE_REQUEST_FILTERS },
      error: null,
    });
    expect(DEFAULT_SCHEDULE_REQUEST_FILTERS).toEqual({ status: 'pending' });
  });

  it('accepts every status the academic service accepts', () => {
    for (const status of ['pending', 'approved', 'rejected', 'cancelled'] as const) {
      expect(parseScheduleRequestFilters({ status })).toEqual({
        filters: { status },
        error: null,
      });
    }
  });

  it('rejects a status outside the backend vocabulary', () => {
    // `open` is a *class* schedule status, not a request status, so it must
    // not be forwarded to an endpoint that answers 400 for it.
    for (const status of ['open', 'all', 'ACTIVE', 'deleted', '']) {
      const input = status === '' ? { status: ['pending', ''] } : { status };
      const result = parseScheduleRequestFilters(input);
      if (status === '') {
        // First value wins, so this reads as pending.
        expect(result).toEqual({ filters: { status: 'pending' }, error: null });
      } else {
        expect(result).toEqual({ filters: null, error: 'invalid_filter' });
      }
    }
  });

  it('reads the first value when a parameter is repeated', () => {
    expect(parseScheduleRequestFilters({ status: ['approved', 'rejected'] })).toEqual({
      filters: { status: 'approved' },
      error: null,
    });
  });

  it('trims a hand-typed status before validating it', () => {
    expect(parseScheduleRequestFilters({ status: '  pending  ' })).toEqual({
      filters: { status: 'pending' },
      error: null,
    });
  });
});

describe('scheduleRequestQueryString', () => {
  it('sends only the status the backend validated', () => {
    expect(scheduleRequestQueryString({ status: 'pending' })).toBe('status=pending');
    expect(scheduleRequestQueryString({ status: '' })).toBe('');
  });

  it('links to this screen at another status filter', () => {
    expect(scheduleRequestPageHref({ status: 'approved' })).toBe(
      `${TENANT_SCHEDULE_REQUESTS_PATH}?status=approved`
    );
    expect(scheduleRequestPageHref({ status: '' })).toBe(TENANT_SCHEDULE_REQUESTS_PATH);
  });
});

describe('schedule request presentation helpers', () => {
  it('labels billing cycles in Indonesian and passes unknown values through', () => {
    expect(scheduleRequestBillingCycleLabel('monthly')).toBe('Bulanan');
    expect(scheduleRequestBillingCycleLabel('quarterly')).toBe('Per tiga bulan');
    expect(scheduleRequestBillingCycleLabel('yearly')).toBe('Tahunan');
    expect(scheduleRequestBillingCycleLabel('weekly')).toBe('weekly');
  });

  it('falls back to a neutral class placeholder', () => {
    expect(scheduleRequestClassName('Matematika Private')).toBe('Matematika Private');
    expect(scheduleRequestClassName('  ')).toBe('Kelas');
    expect(scheduleRequestClassName(null)).toBe('Kelas');
    expect(scheduleRequestClassName(undefined)).toBe('Kelas');
  });

  it('names the student or falls back to a neutral placeholder', () => {
    expect(scheduleRequestStudentName({ first_name: 'Ayu', last_name: 'Lestari' })).toBe('Ayu Lestari');
    expect(scheduleRequestStudentName({ first_name: 'Ayu' })).toBe('Ayu');
    expect(scheduleRequestStudentName({ first_name: '  ' })).toBe('Student');
    expect(scheduleRequestStudentName(null)).toBe('Student');
    expect(scheduleRequestStudentName(undefined)).toBe('Student');
  });

  it('indexes classes by id and skips entries without one', () => {
    const index = classesById([
      { id: 'class-1', name: 'Matematika Private' },
      { id: '', name: 'Tanpa id' },
    ]);
    expect(index.get('class-1')?.name).toBe('Matematika Private');
    expect(index.has('')).toBe(false);
  });

  it('formats the submission time or renders an em dash', () => {
    expect(submittedAtLabel('2026-09-20T10:00:00Z')).toContain('2026');
    expect(submittedAtLabel(null)).toBe('—');
    expect(submittedAtLabel('')).toBe('—');
    expect(submittedAtLabel('bukan tanggal')).toBe('—');
  });

  it('counts the rows for the list header', () => {
    expect(scheduleRequestCountLabel(0)).toBe('0 permintaan');
    expect(scheduleRequestCountLabel(1)).toBe('1 permintaan');
    expect(scheduleRequestCountLabel(3)).toBe('3 permintaan');
  });
});
