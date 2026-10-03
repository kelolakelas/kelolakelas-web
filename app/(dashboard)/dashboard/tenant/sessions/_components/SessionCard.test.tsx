import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SessionCard } from './SessionCard';
import type { TutorSessionRow } from '../_queries/queries';

/**
 * Render test for the tutor session card (KEL-137).
 *
 * The acceptance criterion is that a tutor sees their own session together
 * with the students and the recorded attendance the refresh reads back, so
 * this test renders the card from the exact payload shapes the services
 * emit and asserts the visible text.
 *
 * `renderToStaticMarkup` is used directly instead of a DOM testing library:
 * the card is a Server Component with no state, so the rendered markup is
 * the whole contract. Both layout branches are asserted because the
 * component renders the attendee list and the action area into the same
 * document.
 */

const SESSION_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const ENROLLMENT_ID = 'c0ffee00-1111-4222-8333-444455556666';

function row(overrides: Partial<TutorSessionRow> = {}): TutorSessionRow {
  return {
    session: {
      id: SESSION_ID,
      class_id: 'class-1',
      schedule_id: 'schedule-1',
      session_date: '2026-09-30',
      start_time: '15:30:00',
      end_time: '17:00:00',
      status: 'scheduled',
      class: { id: 'class-1', name: 'Matematika Dasar' },
    },
    attendees: [
      {
        enrollment_id: ENROLLMENT_ID,
        student: { first_name: 'Ayu', last_name: 'Lestari' },
      },
    ],
    attendance: new Map(),
    ...overrides,
  };
}

function render(
  target: TutorSessionRow,
  canRecordAttendance = true,
  canManageSessions = true,
): string {
  return renderToStaticMarkup(
    <SessionCard
      row={target}
      canRecordAttendance={canRecordAttendance}
      canManageSessions={canManageSessions}
      tutors={[]}
      idPrefix="test"
    />
  );
}

describe('SessionCard', () => {
  it('shows the class, schedule, status, and attendees', () => {
    const html = render(row());

    expect(html).toContain('Matematika Dasar');
    expect(html).toContain('15:30–17:00');
    expect(html).toContain('Terjadwal');
    expect(html).toContain('Ayu Lestari');
    expect(html).toContain('Catat kehadiran');
  });

  it('badges the rescheduled state distinctly', () => {
    const html = render(
      row({
        session: {
          ...row().session,
          id: '8d2c7e10-9f3b-4a5c-b6d7-1e2f3a4b5c6d',
          status: 'rescheduled',
        },
      })
    );

    expect(html).toContain('Dijadwalkan ulang');
  });

  it('shows the read-back attendance with a screen-reader status label', () => {
    const html = render(
      row({
        attendance: new Map([
          [ENROLLMENT_ID, { id: 'att-1', enrollment_id: ENROLLMENT_ID, session_id: SESSION_ID, status: 'late' }],
        ]),
      })
    );

    expect(html).toContain('Telat');
    expect(html).toContain('aria-label="Status kehadiran: Telat"');
    expect(html).not.toContain('Belum dicatat');
  });

  it('marks an unrecorded attendee as not yet recorded', () => {
    const html = render(row());

    expect(html).toContain('Belum dicatat');
  });

  it('renders the forbidden panel instead of the dialog without attendance:create', () => {
    const html = render(row(), false);

    expect(html).not.toContain('Catat kehadiran');
    expect(html).toContain('role="alert"');
    expect(html).toContain('attendance:create');
  });

  it('renders the forbidden panel instead of the schedule dialogs without schedule:update', () => {
    const html = render(row(), true, false);

    expect(html).not.toContain('Reschedule');
    expect(html).not.toContain('Tutor pengganti');
    expect(html).toContain('role="alert"');
    expect(html).toContain('schedule:update');
  });

  it('hides both mutations on a cancelled session even with schedule:update', () => {
    const html = render(
      row({
        session: {
          ...row().session,
          status: 'cancelled',
        },
      }),
      true,
      true
    );

    expect(html).toContain('Dibatalkan');
    expect(html).toContain('dibatalkan sehingga tidak dapat di-reschedule');
    expect(html).not.toContain('Reschedule');
    expect(html).not.toContain('Tutor pengganti');
  });

  it('explains the empty session instead of reporting an error', () => {
    const html = render(row({ attendees: [] }));

    expect(html).toContain('Belum ada siswa pada sesi ini');
    expect(html).not.toContain('Catat kehadiran');
    expect(html).not.toContain('role="alert"');
  });

  it('says the saved states are unavailable to the role, not missing', () => {
    const html = render(row({ attendanceForbidden: true }));

    expect(html).toContain('Status tidak tersedia untuk role Anda');
    expect(html).toContain('attendance:read');
  });
});
