import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AddScheduleModal } from './AddScheduleModal';
import { ClassListTable, SchedulesGrid } from './ClassListTable';
import type { Category, ClassEntity, ClassSchedule } from '../_lib/schema';

/**
 * Render tests for the class list and the add-schedule entry point (KEL-50).
 *
 * The acceptance criteria are about what a tenant sees: the schedule rows with
 * their per-slot capacity, an action that opens the schedule form for a group
 * class without one, and no stale "1 Student"/"1 max" claim for a class whose
 * capacity now lives on the schedule. `renderToStaticMarkup` is used directly
 * because these are Server-rendered Client Components with no data-fetching of
 * their own, so the markup is the whole contract and no DOM testing library is
 * needed. A click cannot be simulated in static markup, so the modal assertion
 * renders `AddScheduleModal` itself (the component the button mounts).
 */

const CATEGORY: Category = {
  id: 'cat-1',
  tenant_id: 'tenant-1',
  name: 'Matematika',
  created_at: '2026-09-01T00:00:00Z',
};

const CLASS: ClassEntity = {
  id: 'class-1',
  tenant_id: 'tenant-1',
  category_id: 'cat-1',
  name: 'Matematika Dasar',
  type: 'group',
  price: 150000,
  created_at: '2026-09-01T00:00:00Z',
  category: CATEGORY,
};

const PRIVATE_CLASS: ClassEntity = { ...CLASS, id: 'class-2', type: 'private' };

function scheduleOf(overrides: Partial<ClassSchedule>): ClassSchedule {
  return {
    id: 'sched-1',
    class_id: 'class-1',
    day_of_week: 1,
    start_time: '09:00:00',
    end_time: '10:30:00',
    ...overrides,
  };
}

function renderTable(
  overrides: Partial<React.ComponentProps<typeof ClassListTable>> = {}
): string {
  return renderToStaticMarkup(
    <ClassListTable
      categories={[CATEGORY]}
      classes={[CLASS]}
      schedules={[]}
      {...overrides}
    />
  );
}

describe('SchedulesGrid (schedules tab content)', () => {
  it('shows each schedule together with its capacity', () => {
    const html = renderToStaticMarkup(
      <SchedulesGrid
        schedules={[
          scheduleOf({ id: 'sched-1', capacity: 10 }),
          scheduleOf({ id: 'sched-2', day_of_week: 3, capacity: 4 }),
        ]}
      />
    );

    expect(html).toContain('Mon');
    expect(html).toContain('👥 10 seats');
    expect(html).toContain('Wed');
    expect(html).toContain('👥 4 seats');
  });

  it('uses the singular for a one-seat schedule', () => {
    const html = renderToStaticMarkup(
      <SchedulesGrid schedules={[scheduleOf({ capacity: 1 })]} />
    );

    expect(html).toContain('👥 1 seat');
    expect(html).not.toContain('1 seats');
  });

  it('renders a schedule without capacity rather than a fabricated number', () => {
    const html = renderToStaticMarkup(
      <SchedulesGrid schedules={[scheduleOf({ capacity: undefined })]} />
    );

    expect(html).toContain('Mon');
    expect(html).not.toContain('👥');
  });

  it('labels a private approval schedule without a tutor as Belum ditugaskan', () => {
    const html = renderToStaticMarkup(
      <SchedulesGrid
        schedules={[
          scheduleOf({ id: 'sched-private', enrollment_id: 'enr-1', tutor_id: undefined }),
        ]}
      />
    );

    expect(html).toContain('Belum ditugaskan');
    expect(html).toContain('Tugaskan teacher');
  });

  it('labels an assigned private schedule without reopening the assignment form', () => {
    const html = renderToStaticMarkup(
      <SchedulesGrid
        schedules={[
          scheduleOf({ id: 'sched-private', enrollment_id: 'enr-1', tutor_id: 'tutor-1' }),
        ]}
      />
    );

    expect(html).toContain('Teacher ditugaskan');
    expect(html).not.toContain('Tugaskan teacher');
  });

  it('leaves group schedules without an enrollment out of the assignment flow', () => {
    const html = renderToStaticMarkup(
      <SchedulesGrid schedules={[scheduleOf({ id: 'sched-group', tutor_id: 'tutor-1' })]} />
    );

    expect(html).not.toContain('Belum ditugaskan');
    expect(html).not.toContain('Tugaskan teacher');
  });

  it('shows each class name when two identical schedules come from different classes', () => {
    const html = renderToStaticMarkup(
      <SchedulesGrid
        schedules={[
          scheduleOf({
            id: 'sched-1',
            capacity: 10,
            location: 'Room A',
            class: { ...CLASS, name: 'Matematika Dasar' },
          }),
          scheduleOf({
            id: 'sched-2',
            capacity: 10,
            location: 'Room A',
            class: { ...CLASS, id: 'class-2', name: 'Fisika Lanjutan' },
          }),
        ]}
      />
    );

    expect(html).toContain('Matematika Dasar');
    expect(html).toContain('Fisika Lanjutan');
  });

  it('renders a neutral fallback without crashing when the class relation is absent', () => {
    const html = renderToStaticMarkup(
      <SchedulesGrid schedules={[scheduleOf({ class: undefined })]} />
    );

    expect(html).toContain('Mon');
    expect(html).toContain('Kelas');
    expect(html).not.toContain('Matematika Dasar');
  });

  it('renders a long class name without breaking the card', () => {
    const longName =
      'Kelas Persiapan Ujian Akhir Semester Ganjil Tahun Ajaran Dua Ribu Dua Puluh Enam';
    const html = renderToStaticMarkup(
      <SchedulesGrid
        schedules={[
          scheduleOf({ class: { ...CLASS, name: longName } }),
        ]}
      />
    );

    expect(html).toContain(longName);
    expect(html).toContain('line-clamp-2');
  });
});

describe('ClassListTable classes tab', () => {
  it('does not claim "1 Student" or "1 max" when the class has no stored capacity', () => {
    const html = renderTable();

    // Capacity now lives on the schedule rows, so the deprecated class-level
    // fallback must not render a misleading single-seat claim.
    expect(html).not.toContain('1 Student');
    expect(html).not.toContain('1 max');
    expect(html).toContain('Per schedule');
  });

  it('renders the add-schedule modal for a group class with its capacity field', () => {
    const html = renderToStaticMarkup(<AddScheduleModal classRecord={CLASS} />);

    expect(html).toContain('Add Schedule');
    expect(html).toContain('Matematika Dasar');
  });

  it('uses Edit in both layouts without a separate Add Schedule action', () => {
    const html = renderTable({ classes: [CLASS, PRIVATE_CLASS] });

    // The same group row is rendered once for mobile and once for desktop.
    // Neither markup copy of the private row should have the action.
    const actions = html.split('Add Schedule').length - 1;
    expect(actions).toBe(0);
    expect(html).toContain('Edit');
  });
});
