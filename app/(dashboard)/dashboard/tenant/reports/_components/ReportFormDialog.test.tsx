// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  actionState: { current: { success: false, message: '' } },
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: () => [mocks.actionState.current, vi.fn()],
}));
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  useFormStatus: () => ({ pending: false }),
}));
vi.mock('../_actions/reports', () => ({
  createTenantReport: vi.fn(),
  updateTenantReport: vi.fn(),
}));

/**
 * Render tests for the report form dialog's enrollment select (KEL-139 fix r1).
 *
 * The default Teacher role has no `enrollment:read`, so the auxiliary
 * lookups can legitimately answer with no options — including on the very
 * first report, when no row exists to derive a fallback from. What is
 * asserted is the dialog contract that failure mode depends on:
 *
 * - with options, the required select offers every taught enrollment and the
 *   submit stays enabled;
 * - without options, the dialog says the taught-student list could not be
 *   loaded (instead of a dead required select) and the submit is disabled so
 *   the member cannot file a report that fails server-side validation;
 * - the update dialog never asks for an enrollment, because the backend
 *   checks the assignment against the stored one.
 *
 * The Server Action is stubbed through `useActionState`, following the
 * sessions `AttendanceDialog.test.tsx` pattern. Queries run against the
 * render container because the closed `<dialog>` is hidden from the
 * accessible tree until `showModal` runs.
 */

const { ReportFormDialog } = await import('./ReportFormDialog');

const OPTIONS = [
  { enrollment_id: 'c0ffee00-1111-4222-8333-444455556666', label: 'Budi Santoso · Matematika Dasar' },
];

const REPORT = {
  id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11',
  enrollment_id: 'c0ffee00-1111-4222-8333-444455556666',
  title: 'Evaluasi tengah semester',
};

afterEach(() => cleanup());

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

function dialogOf(container: HTMLElement): HTMLDialogElement {
  const dialog = container.querySelector('dialog');

  if (!(dialog instanceof HTMLDialogElement)) {
    throw new Error('Expected the report dialog to render');
  }

  return dialog;
}

describe('ReportFormDialog enrollment select', () => {
  it('offers the taught enrollments when the lookup succeeds', () => {
    const { container } = render(
      <ReportFormDialog mode="create" enrollmentOptions={OPTIONS} idPrefix="test-create" />
    );
    const dialog = dialogOf(container);
    const select = dialog.querySelector('select[name="enrollment_id"]') as HTMLSelectElement;

    expect(select.required).toBe(true);
    expect([...select.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'Pilih siswa',
      'Budi Santoso · Matematika Dasar',
    ]);
    expect(within(dialog).queryByRole('status', { hidden: true })).toBeNull();
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Buat laporan',
          hidden: true,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
  });

  it('explains an empty option list and disables the submit', () => {
    const { container } = render(
      <ReportFormDialog mode="create" enrollmentOptions={[]} idPrefix="test-empty" />
    );
    const dialog = dialogOf(container);
    const select = dialog.querySelector('select[name="enrollment_id"]') as HTMLSelectElement;

    expect(select.querySelectorAll('option')).toHaveLength(1);
    expect(select.querySelector('option')?.textContent).toMatch(/belum ditemukan/);
    expect(within(dialog).getByRole('status', { hidden: true }).textContent).toMatch(
      /belum dapat dimuat/
    );
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Buat laporan',
          hidden: true,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it('opens from the trigger and asks for no enrollment on update', () => {
    const { container } = render(
      <ReportFormDialog
        mode="update"
        report={REPORT}
        enrollmentOptions={[]}
        idPrefix="test-update"
      />
    );
    const dialog = dialogOf(container);

    expect(dialog.querySelector('select[name="enrollment_id"]')).toBeNull();

    const trigger = container.querySelector('button[aria-haspopup="dialog"]');

    if (!trigger) {
      throw new Error('Expected the update trigger to render');
    }

    fireEvent.click(trigger);
    expect(dialog.open).toBe(true);
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Simpan perubahan',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
  });
});
