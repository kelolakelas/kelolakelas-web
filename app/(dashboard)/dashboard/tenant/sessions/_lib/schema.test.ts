import { describe, expect, it } from 'vitest';

import {
  attendanceByEnrollment,
  attendanceStatusLabel,
  normalizeSessionAttendance,
  normalizeSessionAttendees,
  parseSessionFilters,
  sessionAttendanceQueryString,
  sessionClassName,
  sessionCountLabel,
  sessionDateLabel,
  sessionDateRange,
  sessionPageHref,
  sessionQueryString,
  sessionStatusLabel,
  sessionTimeLabel,
  sessionAttendeeName,
} from './schema';

/**
 * Unit tests for the tutor session vocabulary and pure helpers (KEL-137).
 *
 * Everything asserted here is synchronous and side effect free: the filter
 * parsing, the Asia/Jakarta day/week windows, the request builders, and the
 * response normalisers. The behaviours pinned are the ones the acceptance
 * criteria name: the tutor's own sessions for today and this week including
 * reschedules, the Indonesian attendance labels, and the invalid-filter
 * explanation instead of a failed request.
 */

const CLASS_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const SESSION_ID = '8d2c7e10-9f3b-4a5c-b6d7-1e2f3a4b5c6d';
const ENROLLMENT_ID = 'c0ffee00-1111-4222-8333-444455556666';

describe('parseSessionFilters', () => {
  it('defaults to today with no class filter', () => {
    expect(parseSessionFilters({})).toEqual({
      filters: { range: 'today', class_id: '' },
      error: null,
    });
  });

  it('accepts the week range and a UUID class', () => {
    expect(parseSessionFilters({ range: 'week', class_id: CLASS_ID })).toEqual({
      filters: { range: 'week', class_id: CLASS_ID },
      error: null,
    });
  });

  it('reads the first value of a repeated parameter', () => {
    expect(parseSessionFilters({ range: ['week', 'today'] })).toEqual({
      filters: { range: 'week', class_id: '' },
      error: null,
    });
  });

  it('rejects a range outside the today/week vocabulary', () => {
    expect(parseSessionFilters({ range: 'month' })).toEqual({
      filters: null,
      error: 'invalid_filter',
    });
  });

  it('rejects a class_id that is not a UUID without calling the backend', () => {
    expect(parseSessionFilters({ class_id: 'not-a-uuid' })).toEqual({
      filters: null,
      error: 'invalid_filter',
    });
  });
});

describe('sessionDateRange', () => {
  // 2026-09-30 is a Wednesday (Asia/Jakarta).
  const wednesdayNoonUtc = new Date('2026-09-30T05:00:00Z');

  it('covers the single Jakarta day for the today range', () => {
    expect(sessionDateRange({ range: 'today', class_id: '' }, wednesdayNoonUtc)).toEqual({
      date_from: '2026-09-30',
      date_to: '2026-09-30',
    });
  });

  it('covers Monday to Sunday of the Jakarta week', () => {
    expect(sessionDateRange({ range: 'week', class_id: '' }, wednesdayNoonUtc)).toEqual({
      date_from: '2026-09-28',
      date_to: '2026-10-04',
    });
  });

  it('opens the new week on a Monday', () => {
    // Monday 2026-09-28 00:30 Asia/Jakarta is still Sunday in UTC.
    const mondayEarly = new Date('2026-09-27T17:30:00Z');

    expect(sessionDateRange({ range: 'week', class_id: '' }, mondayEarly)).toEqual({
      date_from: '2026-09-28',
      date_to: '2026-10-04',
    });
  });

  it('keeps Sunday inside the week that is ending', () => {
    // Sunday 2026-10-04 23:30 Asia/Jakarta is still Sunday in UTC.
    const sundayLate = new Date('2026-10-04T16:30:00Z');

    expect(sessionDateRange({ range: 'week', class_id: '' }, sundayLate)).toEqual({
      date_from: '2026-09-28',
      date_to: '2026-10-04',
    });
  });
});

describe('sessionQueryString', () => {
  it('always scopes to the caller and the date window', () => {
    const query = new URLSearchParams(
      sessionQueryString(
        { range: 'today', class_id: '' },
        { date_from: '2026-09-30', date_to: '2026-09-30' }
      )
    );

    expect(query.get('mine')).toBe('true');
    expect(query.get('date_from')).toBe('2026-09-30');
    expect(query.get('date_to')).toBe('2026-09-30');
    expect(query.get('class_id')).toBeNull();
    // No client-supplied tutor_id is ever sent: the backend derives the
    // tutor from the verified JWT member claim (KEL-135).
    expect(query.get('tutor_id')).toBeNull();
  });

  it('forwards the accepted class filter', () => {
    const query = new URLSearchParams(
      sessionQueryString(
        { range: 'week', class_id: CLASS_ID },
        { date_from: '2026-09-28', date_to: '2026-10-04' }
      )
    );

    expect(query.get('class_id')).toBe(CLASS_ID);
  });
});

describe('sessionAttendanceQueryString', () => {
  it('asks for one enrollment at a bounded page', () => {
    const query = new URLSearchParams(sessionAttendanceQueryString(ENROLLMENT_ID));

    expect(query.get('enrollment_id')).toBe(ENROLLMENT_ID);
    expect(query.get('page_size')).toBe('100');
  });
});

describe('sessionPageHref', () => {
  it('keeps the default range as a clean URL', () => {
    expect(sessionPageHref({ range: 'today', class_id: '' })).toBe('/dashboard/tenant/sessions');
  });

  it('round-trips the week range and the class filter', () => {
    expect(sessionPageHref({ range: 'week', class_id: CLASS_ID })).toBe(
      `/dashboard/tenant/sessions?range=week&class_id=${CLASS_ID}`
    );
  });
});

describe('attendanceStatusLabel', () => {
  it('labels every backend status in Indonesian', () => {
    expect(attendanceStatusLabel('present')).toBe('Hadir');
    expect(attendanceStatusLabel('late')).toBe('Telat');
    expect(attendanceStatusLabel('excused')).toBe('Izin');
    expect(attendanceStatusLabel('absent')).toBe('Alfa');
  });

  it('shows an unknown status verbatim instead of hiding it', () => {
    expect(attendanceStatusLabel('mystery')).toBe('mystery');
  });
});

describe('sessionAttendeeName', () => {
  it('joins the first name and the surname', () => {
    expect(sessionAttendeeName({ first_name: 'Ayu', last_name: 'Lestari' })).toBe('Ayu Lestari');
  });

  it('falls back to the legacy surname key', () => {
    expect(sessionAttendeeName({ first_name: 'Budi', ['lastå_name']: 'Santoso' })).toBe(
      'Budi Santoso'
    );
  });

  it('renders a neutral placeholder when the student is missing', () => {
    expect(sessionAttendeeName(null)).toBe('Student');
    expect(sessionAttendeeName({ first_name: '  ', last_name: '  ' })).toBe('Student');
  });
});

describe('normalizeSessionAttendees', () => {
  it('reads the bare enrollment array with preloaded students', () => {
    expect(
      normalizeSessionAttendees([
        { id: ENROLLMENT_ID, student: { first_name: 'Ayu', last_name: 'Lestari' } },
        { id: SESSION_ID, student: null },
      ])
    ).toEqual([
      {
        enrollment_id: ENROLLMENT_ID,
        student: { first_name: 'Ayu', last_name: 'Lestari' },
      },
      { enrollment_id: SESSION_ID, student: null },
    ]);
  });

  it('skips entries without a usable enrollment id', () => {
    expect(
      normalizeSessionAttendees([{ id: '', student: null }, null, 'nope', { student: null }])
    ).toEqual([]);
  });

  it('reads nothing from a non-array payload instead of throwing', () => {
    expect(normalizeSessionAttendees(null)).toEqual([]);
    expect(normalizeSessionAttendees({ items: [] })).toEqual([]);
  });
});

describe('normalizeSessionAttendance', () => {
  it('keeps rows that carry every identifier the read-back matches on', () => {
    expect(
      normalizeSessionAttendance([
        { id: 'att-1', enrollment_id: ENROLLMENT_ID, session_id: SESSION_ID, status: 'present' },
      ])
    ).toEqual([
      { id: 'att-1', enrollment_id: ENROLLMENT_ID, session_id: SESSION_ID, status: 'present' },
    ]);
  });

  it('skips rows missing an identifier instead of showing them nowhere', () => {
    expect(
      normalizeSessionAttendance([
        { id: 'att-1', enrollment_id: ENROLLMENT_ID, session_id: '', status: 'present' },
        { enrollment_id: ENROLLMENT_ID, session_id: SESSION_ID, status: 'present' },
        { id: 'att-2', enrollment_id: ENROLLMENT_ID, session_id: SESSION_ID, status: 'late' },
      ])
    ).toEqual([
      { id: 'att-2', enrollment_id: ENROLLMENT_ID, session_id: SESSION_ID, status: 'late' },
    ]);
  });
});

describe('attendanceByEnrollment', () => {
  const records = [
    { id: 'att-1', enrollment_id: ENROLLMENT_ID, session_id: SESSION_ID, status: 'present' },
    { id: 'att-2', enrollment_id: ENROLLMENT_ID, session_id: 'other-session', status: 'absent' },
  ];

  it('matches only the rows of the saved session', () => {
    const index = attendanceByEnrollment(records, SESSION_ID);

    expect(index.get(ENROLLMENT_ID)?.id).toBe('att-1');
    expect(index.size).toBe(1);
  });

  it('keeps the first row when an enrollment carries two rows for one session', () => {
    const index = attendanceByEnrollment(
      [
        ...records,
        { id: 'att-3', enrollment_id: ENROLLMENT_ID, session_id: SESSION_ID, status: 'late' },
      ],
      SESSION_ID
    );

    expect(index.get(ENROLLMENT_ID)?.id).toBe('att-1');
  });
});

describe('session presentation labels', () => {
  it('formats the session date for an Indonesian reader', () => {
    expect(sessionDateLabel('2026-09-30')).toContain('September');
    expect(sessionDateLabel('2026-09-30')).toContain('2026');
  });

  it('renders an em dash for a missing or malformed date', () => {
    expect(sessionDateLabel(null)).toBe('—');
    expect(sessionDateLabel('30-09-2026')).toBe('—');
  });

  it('renders the start-end window from the raw time strings', () => {
    expect(sessionTimeLabel('15:30:00', '17:00:00')).toBe('15:30–17:00');
    expect(sessionTimeLabel(null, '17:00:00')).toBe('—');
  });

  it('keeps the rescheduled badge distinct from the scheduled one', () => {
    expect(sessionStatusLabel('scheduled')).toBe('Terjadwal');
    expect(sessionStatusLabel('rescheduled')).toBe('Dijadwalkan ulang');
    expect(sessionStatusLabel('cancelled')).toBe('Dibatalkan');
    expect(sessionStatusLabel('completed')).toBe('Selesai');
    expect(sessionStatusLabel('mystery')).toBe('mystery');
  });

  it('names the class or falls back to a neutral placeholder', () => {
    expect(
      sessionClassName({
        id: SESSION_ID,
        class_id: CLASS_ID,
        session_date: '2026-09-30',
        start_time: '15:30:00',
        end_time: '17:00:00',
        status: 'scheduled',
        class: { name: 'Matematika Dasar' },
      })
    ).toBe('Matematika Dasar');

    expect(
      sessionClassName({
        id: SESSION_ID,
        class_id: CLASS_ID,
        session_date: '2026-09-30',
        start_time: '15:30:00',
        end_time: '17:00:00',
        status: 'scheduled',
        class: { name: '  ' },
      })
    ).toBe('Kelas');
  });

  it('counts the sessions in Indonesian', () => {
    expect(sessionCountLabel({ page: 1, page_size: 100, total_items: 1, total_pages: 1 })).toBe(
      '1 sesi'
    );
    expect(sessionCountLabel({ page: 1, page_size: 100, total_items: 3, total_pages: 1 })).toBe(
      '3 sesi'
    );
  });
});
