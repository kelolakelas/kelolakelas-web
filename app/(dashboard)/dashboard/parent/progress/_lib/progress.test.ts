import { describe, expect, it } from 'vitest';

import {
  attendanceForStudent,
  formatJakartaDate,
  formatSessionLabel,
  isProgressUuid,
  reportsForStudent,
  resolveSelectedStudentId,
  sessionsForStudent,
  summarizeAttendance,
  upcomingWindow,
  type ProgressAttendance,
  type ProgressEnrollment,
  type ProgressReport,
  type ProgressSession,
} from './progress';

/**
 * Pure attribution and formatting for the parent progress portal (KEL-141).
 *
 * Sessions carry no `student_id` filter server-side, so one child's rows are
 * attributed through the enrollment join; attendance and reports narrow via
 * `student_id` in `_queries` and are re-checked here per child.
 */

const A = '123e4567-e89b-12d3-a456-426614174001';
const B = '123e4567-e89b-12d3-a456-426614174002';
const ENROLL_A = '223e4567-e89b-12d3-a456-426614174001';
const ENROLL_B = '223e4567-e89b-12d3-a456-426614174002';
const SCHED_A = '323e4567-e89b-12d3-a456-426614174001';
const SCHED_B = '323e4567-e89b-12d3-a456-426614174002';

const enrollments: ProgressEnrollment[] = [
  { id: ENROLL_A, student_id: A, schedule_id: SCHED_A },
  { id: ENROLL_B, student_id: B, schedule_id: SCHED_B },
];

describe('resolveSelectedStudentId', () => {
  it('keeps the requested child when it belongs to the parent', () => {
    expect(resolveSelectedStudentId([A, B], B)).toBe(B);
  });

  it('falls back to the first child for a stale, foreign, or malformed value', () => {
    expect(resolveSelectedStudentId([A, B], 'not-a-uuid')).toBe(A);
    expect(resolveSelectedStudentId([A, B], '423e4567-e89b-12d3-a456-426614174099')).toBe(A);
    expect(resolveSelectedStudentId([A, B], null)).toBe(A);
    expect(resolveSelectedStudentId([A, B], undefined)).toBe(A);
  });

  it('returns null when the parent has no students', () => {
    expect(resolveSelectedStudentId([], A)).toBeNull();
  });
});

describe('sessionsForStudent', () => {
  const privateA: ProgressSession = { id: 's1', enrollment_id: ENROLL_A };
  const privateB: ProgressSession = { id: 's2', enrollment_id: ENROLL_B };
  const groupA: ProgressSession = { id: 's3', schedule_id: SCHED_A };
  const groupB: ProgressSession = { id: 's4', schedule_id: SCHED_B };

  it('attributes private sessions through the enrollment join', () => {
    const got = sessionsForStudent([privateA, privateB], enrollments, A);
    expect(got.map((s) => s.id)).toEqual(['s1']);
  });

  it('attributes group sessions through the child schedule', () => {
    const got = sessionsForStudent([groupA, groupB], enrollments, B);
    expect(got.map((s) => s.id)).toEqual(['s4']);
  });

  it('attributes a reschedule replacement like its origin session', () => {
    const origin: ProgressSession = { id: 'origin', schedule_id: SCHED_A, status: 'rescheduled' };
    const replacement: ProgressSession = {
      id: 'replacement',
      schedule_id: null,
      rescheduled_from_session_id: origin.id,
    };
    const got = sessionsForStudent([origin, replacement], enrollments, A);
    expect(got.map((s) => s.id).sort()).toEqual(['origin', 'replacement']);
    expect(sessionsForStudent([origin, replacement], enrollments, B)).toEqual([]);
  });

  it('never mixes two children rows', () => {
    const rows: ProgressSession[] = [privateA, privateB, groupA, groupB];
    expect(sessionsForStudent(rows, enrollments, A).map((s) => s.id).sort()).toEqual(['s1', 's3']);
    expect(sessionsForStudent(rows, enrollments, B).map((s) => s.id).sort()).toEqual(['s2', 's4']);
  });
});

describe('attendanceForStudent / reportsForStudent', () => {
  it('keeps only rows whose enrollment belongs to the child', () => {
    const rows: ProgressAttendance[] = [
      { id: 'a1', enrollment_id: ENROLL_A, status: 'present' },
      { id: 'a2', enrollment_id: ENROLL_B, status: 'absent' },
    ];
    expect(attendanceForStudent(rows, enrollments, A).map((r) => r.id)).toEqual(['a1']);
  });

  it('matches reports through the enrollment join or the preloaded enrollment', () => {
    const rows: ProgressReport[] = [
      { id: 'r1', enrollment_id: ENROLL_A, title: 'A' },
      { id: 'r2', enrollment_id: ENROLL_B, title: 'B' },
      { id: 'r3', enrollment: { id: ENROLL_A, student_id: A }, title: 'C' },
    ];
    expect(reportsForStudent(rows, enrollments, A).map((r) => r.id).sort()).toEqual(['r1', 'r3']);
  });
});

describe('summarizeAttendance', () => {
  it('counts every status and the total', () => {
    const rows: ProgressAttendance[] = [
      { id: '1', status: 'present' },
      { id: '2', status: 'present' },
      { id: '3', status: 'late' },
      { id: '4', status: 'excused' },
      { id: '5', status: 'absent' },
      { id: '6', status: 'unknown-state' },
    ];
    expect(summarizeAttendance(rows)).toEqual({
      present: 2,
      absent: 1,
      late: 1,
      excused: 1,
      total: 6,
    });
  });

  it('summarises an empty history as zeros', () => {
    expect(summarizeAttendance([])).toEqual({ present: 0, absent: 0, late: 0, excused: 0, total: 0 });
  });
});

describe('upcomingWindow', () => {
  it('covers today through thirteen days later', () => {
    expect(upcomingWindow('2026-10-02')).toEqual({ dateFrom: '2026-10-02', dateTo: '2026-10-15' });
  });
});

describe('formatting', () => {
  it('validates progress ids as UUIDs', () => {
    expect(isProgressUuid(A)).toBe(true);
    expect(isProgressUuid('not-a-uuid')).toBe(false);
  });

  it('renders dates in Indonesian without throwing on bad input', () => {
    expect(formatJakartaDate('2026-10-02')).toContain('2026');
    expect(formatJakartaDate(null)).toBe('—');
    expect(formatJakartaDate('bukan-tanggal')).toBe('—');
  });

  it('renders a session label with date and WIB time range', () => {
    expect(
      formatSessionLabel({ id: 's', session_date: '2026-10-03', start_time: '16:00:00', end_time: '17:30:00' }),
    ).toContain('16:00');
  });
});
