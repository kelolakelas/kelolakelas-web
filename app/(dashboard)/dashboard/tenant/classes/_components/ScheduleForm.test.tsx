// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const actionState = vi.hoisted(() => ({
  current: { success: false, message: '' } as Record<string, unknown>,
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: () => [actionState.current, vi.fn()],
}));

import { ScheduleForm } from './ScheduleForm';
import type { ClassEntity } from '../_lib/schema';

/**
 * Interaction tests for the weekly slot generator (KEL-112).
 *
 * The generator section sits above the manual slot list in `ScheduleForm`
 * (rendered for group classes by both the creation wizard and
 * `AddScheduleModal`): checked days plus a time window, session length, and
 * break produce reviewable slots that join the existing list, stay editable
 * and deletable, and never duplicate an identical slot. `useActionState` is
 * stubbed with a controlled state (the same pattern as the class form tests)
 * so the suite asserts only client-side generation, never the Server Action.
 */

const GROUP_CLASS: ClassEntity = {
  id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11',
  tenant_id: 'tenant-1',
  category_id: '8d2c7e10-9f3b-4a5c-b6d7-1e2f3a4b5c6d',
  name: 'Matematika Dasar',
  type: 'group',
  price: 150000,
  created_at: '2026-09-01T00:00:00Z',
};

function renderForm() {
  return render(
    <ScheduleForm
      createdClass={GROUP_CLASS}
      onScheduleSuccess={() => {}}
      onBack={() => {}}
    />
  );
}

function slotCount() {
  return screen.getAllByText(/Slot #\d+/).length;
}

function generate() {
  fireEvent.click(screen.getByRole('button', { name: 'Generate Slots' }));
}

beforeEach(() => {
  actionState.current = { success: false, message: '' };
});

afterEach(() => {
  cleanup();
});

describe('ScheduleForm weekly slot generator', () => {
  it('renders the generator with Monday and Tuesday checked by default', () => {
    renderForm();

    expect(
      screen.getByRole('heading', { name: 'Weekly Slot Generator' })
    ).toBeTruthy();
    expect(
      (screen.getByLabelText('Generate on Monday') as HTMLInputElement).checked
    ).toBe(true);
    expect(
      (screen.getByLabelText('Generate on Tuesday') as HTMLInputElement).checked
    ).toBe(true);
    expect(
      (screen.getByLabelText('Generate on Sunday') as HTMLInputElement).checked
    ).toBe(false);
    // The manual slot list is unchanged: one default slot plus Add Slot.
    expect(slotCount()).toBe(1);
    expect(screen.getByRole('button', { name: 'Add Slot' })).toBeTruthy();
  });

  it('generates two slots per checked day and appends them to the manual slot', () => {
    renderForm();

    generate();

    // Monday 08:00-09:30 + 09:45-11:15 and the same pair for Tuesday join
    // the one manual slot; none matches it exactly so nothing is skipped.
    expect(slotCount()).toBe(5);
    expect(screen.getByRole('status').textContent).toBe('Added 4 slots.');
  });

  it('skips duplicates when generated twice with the same parameters', () => {
    renderForm();

    generate();
    expect(slotCount()).toBe(5);

    generate();
    expect(slotCount()).toBe(5);
    expect(screen.getByRole('status').textContent).toBe(
      'All generated slots already exist. No duplicate slots were added.'
    );
  });

  it('generates for a newly checked day after unchecking the existing days', () => {
    renderForm();

    generate();
    expect(slotCount()).toBe(5);

    fireEvent.click(screen.getByLabelText('Generate on Monday'));
    fireEvent.click(screen.getByLabelText('Generate on Tuesday'));
    fireEvent.click(screen.getByLabelText('Generate on Sunday'));

    generate();

    // Only Sunday is checked now: its two sessions are fresh, so they join.
    expect(slotCount()).toBe(7);
    expect(screen.getByRole('status').textContent).toBe('Added 2 slots.');
  });

  it('keeps generated slots editable and deletable', () => {
    renderForm();

    generate();
    expect(slotCount()).toBe(5);

    // Edit: the capacity input of the first slot stays a plain editable field.
    const capacity = screen.getByLabelText(
      'Capacity for slot 1'
    ) as HTMLInputElement;
    fireEvent.change(capacity, { target: { value: '25' } });
    expect(capacity.value).toBe('25');

    // Delete: removing the first slot drops the count by exactly one.
    fireEvent.click(screen.getByLabelText('Remove slot 1'));
    expect(slotCount()).toBe(4);
  });

  it('shows a per-field message and adds no slot when the session length is cleared', () => {
    renderForm();

    fireEvent.change(
      screen.getByLabelText('Generator session length in minutes'),
      { target: { value: '' } }
    );

    generate();

    expect(screen.getByText('Session length must be greater than 0')).toBeTruthy();
    expect(slotCount()).toBe(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows a per-field message and adds no slot when no day is checked', () => {
    renderForm();

    fireEvent.click(screen.getByLabelText('Generate on Monday'));
    fireEvent.click(screen.getByLabelText('Generate on Tuesday'));

    generate();

    expect(screen.getByText('Select at least one day')).toBeTruthy();
    expect(slotCount()).toBe(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows a per-field message and adds no slot when the window is reversed', () => {
    renderForm();

    fireEvent.change(screen.getByLabelText('Generator start time'), {
      target: { value: '12:00' },
    });
    fireEvent.change(screen.getByLabelText('Generator end time'), {
      target: { value: '08:00' },
    });

    generate();

    expect(
      screen.getByText('End time must be strictly after start time')
    ).toBeTruthy();
    expect(slotCount()).toBe(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('reports a fitting problem without adding slots when no session fits', () => {
    renderForm();

    fireEvent.change(
      screen.getByLabelText('Generator session length in minutes'),
      { target: { value: '300' } }
    );

    generate();

    expect(screen.getByRole('status').textContent).toBe(
      'No session fits the selected time range. Adjust the hours, session length, or break.'
    );
    expect(slotCount()).toBe(1);
  });
});
