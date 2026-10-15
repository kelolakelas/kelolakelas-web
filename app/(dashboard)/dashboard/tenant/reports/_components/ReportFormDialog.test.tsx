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
vi.mock('../_actions/enrollment-search', () => ({
  searchDirectEnrollments: vi.fn(async () => ({ data: null, error: 'api' as const, message: 'x' })),
  searchTaughtEnrollments: vi.fn(async () => ({ data: null, error: 'api' as const, message: 'x' })),
}));

/**
 * Render tests for the report form dialog's student picker (KEL-167).
 *
 * The create mode no longer renders a static select fed by page-load
 * options: it renders the server-search picker, which reads one backend
 * page per explicit search/pagination action and never fetches on mount.
 * What is asserted is the dialog contract the picker plugs into:
 *
 * - the create form carries a search box backed by a hidden `enrollment_id`
 *   field (the exact name the Server Action validates), and the submit
 *   starts disabled until a student is chosen — so an empty submit cannot
 *   file a report that fails server-side validation;
 * - the update dialog still asks for no enrollment, because the backend
 *   checks the assignment against the stored one.
 *
 * The Server Action is stubbed through `useActionState`, following the
 * sessions `AttendanceDialog.test.tsx` pattern. Queries run against the
 * render container because the closed `<dialog>` is hidden from the
 * accessible tree until `showModal` runs.
 */

const { ReportFormDialog } = await import('./ReportFormDialog');

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

function createSubmitOf(dialog: HTMLElement): HTMLButtonElement {
  return within(dialog).getByRole('button', {
    name: 'Buat laporan',
    hidden: true,
  }) as HTMLButtonElement;
}

describe('ReportFormDialog student picker', () => {
  it('renders the search picker with an empty hidden enrollment field', () => {
    const { container } = render(<ReportFormDialog mode="create" idPrefix="test-create" />);
    const dialog = dialogOf(container);

    // The hidden field carries the exact name the Server Action validates;
    // it starts empty so no stale enrollment can be submitted.
    const hidden = dialog.querySelector('input[type="hidden"][name="enrollment_id"]');
    expect(hidden).not.toBeNull();
    expect((hidden as HTMLInputElement).value).toBe('');

    expect(
      within(dialog).getByRole('searchbox', { hidden: true, name: 'Siswa' })
    ).not.toBeNull();

    // No static options ship with the form anymore.
    expect(dialog.querySelector('select[name="enrollment_id"]')).toBeNull();
  });

  it('keeps the create submit disabled until a student is chosen', () => {
    const { container } = render(<ReportFormDialog mode="create" idPrefix="test-empty" />);
    const dialog = dialogOf(container);

    expect(createSubmitOf(dialog).disabled).toBe(true);
  });

  it('explains that results load per page from the server', () => {
    const { container } = render(<ReportFormDialog mode="create" idPrefix="test-hint" />);
    const dialog = dialogOf(container);

    expect(dialog.textContent).toMatch(/diambil per halaman dari server/);
  });

  it('opens from the trigger and asks for no enrollment on update', () => {
    const { container } = render(
      <ReportFormDialog mode="update" report={REPORT} idPrefix="test-update" />
    );
    const dialog = dialogOf(container);

    expect(dialog.querySelector('input[name="enrollment_id"]')).toBeNull();

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
