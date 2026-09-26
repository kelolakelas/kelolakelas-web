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

  it('keeps the private class row free of the add-schedule action', () => {
    const html = renderTable({ classes: [CLASS, PRIVATE_CLASS] });

    // The same group row is rendered once for mobile and once for desktop.
    // Neither markup copy of the private row should have the action.
    const actions = html.split('Add Schedule').length - 1;
    expect(actions).toBe(2);
  });
});
