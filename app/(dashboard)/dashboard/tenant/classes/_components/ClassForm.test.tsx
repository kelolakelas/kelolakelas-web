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

vi.mock('../_actions/classActions', () => ({ createClass: vi.fn() }));

import { ClassForm } from './ClassForm';
import type { Category } from '../_lib/schema';

/**
 * Render tests for the class creation form without class-level capacity
 * (KEL-113).
 *
 * Capacity moved to the per-schedule step (`scheduleItemSchema`), so this
 * form must not render a capacity input on either class type. A short helper
 * text per type explains where capacity now lives, and the hidden `type`
 * field still follows the selector so the wizard proceeds to scheduling as
 * before. `useActionState` is stubbed with a controlled state (the same
 * pattern as the auth form tests) so the error branch renders deterministically.
 */

const CATEGORY: Category = {
  id: 'cat-1',
  tenant_id: 'tenant-1',
  name: 'Matematika',
  created_at: '2026-09-01T00:00:00Z',
};

const GROUP_HELP =
  'Group class capacity is set per schedule in the next scheduling step.';
const PRIVATE_HELP =
  'Private class is 1-on-1 for a single student; schedules are agreed per enrollment.';

function renderForm() {
  return render(
    <ClassForm
      selectedCategory={CATEGORY}
      onClassCreated={() => {}}
      onBack={() => {}}
    />
  );
}

beforeEach(() => {
  actionState.current = { success: false, message: '' };
});

afterEach(() => {
  cleanup();
});

describe('ClassForm without class-level capacity', () => {
  it('renders no capacity input on the default group type', () => {
    const { container } = renderForm();

    expect(
      container.querySelector('input[name="capacity"]')
    ).toBeNull();
    expect(screen.queryByLabelText(/capacity/i)).toBeNull();
    expect(screen.getByText(GROUP_HELP)).toBeTruthy();
    expect(screen.queryByText(PRIVATE_HELP)).toBeNull();
    // The rest of the form still renders: category banner, price, submit.
    expect(screen.getByText('Matematika')).toBeTruthy();
    expect(screen.getByLabelText(/Price \(IDR\)/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Save & Proceed to Scheduling/ })
    ).toBeTruthy();
  });

  it('renders no capacity input with the private helper text', () => {
    const { container } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: /Private 1-on-1/ }));

    expect(
      container.querySelector('input[name="capacity"]')
    ).toBeNull();
    expect(screen.getByText(PRIVATE_HELP)).toBeTruthy();
    expect(screen.queryByText(GROUP_HELP)).toBeNull();
  });

  it('switches the helper text back when toggled group to private to group', () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: /Private 1-on-1/ }));
    expect(screen.getByText(PRIVATE_HELP)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Group Class/ }));
    expect(screen.getByText(GROUP_HELP)).toBeTruthy();
    expect(screen.queryByText(PRIVATE_HELP)).toBeNull();
  });

  it('keeps submitting the selected type through the hidden field', () => {
    const { container } = renderForm();

    const typeInput = container.querySelector(
      'input[name="type"]'
    ) as HTMLInputElement;
    expect(typeInput?.value).toBe('group');

    fireEvent.click(screen.getByRole('button', { name: /Private 1-on-1/ }));
    expect(
      (container.querySelector('input[name="type"]') as HTMLInputElement)
        ?.value
    ).toBe('private');
    expect(
      container.querySelector('input[name="category_id"]')
    ).not.toBeNull();
  });

  it('shows the action validation message without a capacity error', () => {
    actionState.current = {
      success: false,
      message: 'Validation failed. Please check form fields.',
      errors: { price: ['Price cannot be negative'] },
    };
    const { container } = renderForm();

    expect(
      screen.getByText('Validation failed. Please check form fields.')
    ).toBeTruthy();
    expect(screen.getByText('Price cannot be negative')).toBeTruthy();
    expect(
      container.querySelector('input[name="capacity"]')
    ).toBeNull();
  });
});
