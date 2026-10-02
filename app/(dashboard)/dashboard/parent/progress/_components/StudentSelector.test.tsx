// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

/**
 * Behaviour test for the KEL-141 child selector (AC1).
 *
 * The selector is a plain GET navigation over `?student=<id>`: choosing the
 * second child pushes the progress route with that child's id, and the server
 * falls back to the first child for a stale value (pinned in
 * `progress.test.ts`). Rendered only when the parent has more than one child.
 */

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

const { StudentSelector } = await import('./StudentSelector');

const A = '123e4567-e89b-12d3-a456-426614174001';
const B = '123e4567-e89b-12d3-a456-426614174002';

const students = [
  { id: A, parent_id: 'parent-1', first_name: 'Budi' },
  { id: B, parent_id: 'parent-1', first_name: 'Sari' },
];

afterEach(() => {
  cleanup();
  mocks.push.mockClear();
});

describe('StudentSelector', () => {
  it('lists every child and marks the selected one', () => {
    render(<StudentSelector students={students} selectedId={A} />);

    const select = screen.getByLabelText('Anak') as HTMLSelectElement;
    expect(select.value).toBe(A);
    expect(screen.getByRole('option', { name: 'Budi' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Sari' })).toBeTruthy();
  });

  it('navigates to the chosen child so the server renders their data', () => {
    render(<StudentSelector students={students} selectedId={A} />);

    fireEvent.change(screen.getByLabelText('Anak'), { target: { value: B } });

    expect(mocks.push).toHaveBeenCalledWith(`/dashboard/parent/progress?student=${B}`);
  });

  it('is labelled for assistive technology', () => {
    render(<StudentSelector students={students} selectedId={B} />);

    expect(screen.getByRole('form', { name: 'Pilih anak' })).toBeTruthy();
    expect(screen.getByLabelText('Anak')).toBeTruthy();
  });
});
