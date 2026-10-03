// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  which: { current: 'reschedule' } as { current: string },
  rescheduleState: { current: { success: false, message: '' } as Record<string, unknown> },
  substituteState: { current: { success: false, message: '' } as Record<string, unknown> },
  rescheduleSession: vi.fn(),
  assignSubstituteTutor: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: () =>
    mocks.which.current === 'substitute'
      ? [mocks.substituteState.current, vi.fn()]
      : [mocks.rescheduleState.current, vi.fn()],
}));
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  useFormStatus: () => ({ pending: false }),
}));
vi.mock('../_actions/schedule', () => ({
  rescheduleSession: mocks.rescheduleSession,
  assignSubstituteTutor: mocks.assignSubstituteTutor,
}));

/**
 * Interaction tests for the reschedule and substitute-tutor dialogs
 * (KEL-138).
 *
 * The Server Actions are stubbed through `useActionState`, so what is
 * asserted is the dialog contract the acceptance criteria depend on:
 *
 * - the member opens each dialog from its trigger and focus returns to it on
 *   close, so keyboard users do not lose their place in the session list,
 * - a backend validation refusal keeps the dialog open with the action
 *   message announced as an alert while the member's input stays in the
 *   named fields, and a success is announced as a status,
 * - an empty tutor list renders its own empty state instead of a broken
 *   select.
 */

const { RescheduleDialog } = await import('./RescheduleDialog');
const { SubstituteTutorDialog } = await import('./SubstituteTutorDialog');

const SESSION_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const TUTOR_ID = 'aaaaaaaa-1111-4222-8333-444455556666';
const TUTORS = [
  { id: TUTOR_ID, name: 'Budi Hartono', email: 'budi@example.com' },
  { id: 'bbbbbbbb-1111-4222-8333-444455556666', name: 'Ayu Lestari', email: '' },
];

beforeEach(() => {
  mocks.rescheduleState.current = { success: false, message: '' };
  mocks.substituteState.current = { success: false, message: '' };
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
      this.dispatchEvent(new Event('close'));
    },
  });
});

afterEach(() => cleanup());

describe('RescheduleDialog', () => {
  function renderDialog() {
    mocks.which.current = 'reschedule';
    return render(
      <RescheduleDialog sessionId={SESSION_ID} sessionLabel="Sesi label" idPrefix="sched" />
    );
  }

  it('opens the dialog on trigger and returns focus on close', () => {
    renderDialog();
    const trigger = screen.getByRole('button', { name: 'Reschedule' });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tutup dialog reschedule' }));
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the member input in the named fields when the backend refuses', () => {
    mocks.rescheduleState.current = {
      success: false,
      message: 'Tanggal atau waktu reschedule tidak valid.',
    };
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));

    fireEvent.change(screen.getByLabelText('Tanggal baru'), { target: { value: '2999-10-05' } });
    fireEvent.change(screen.getByLabelText('Jam mulai baru'), { target: { value: '15:30' } });
    fireEvent.change(screen.getByLabelText('Jam selesai baru'), { target: { value: '17:00' } });

    expect(screen.getByRole('alert').textContent).toContain('tidak valid');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText('Tanggal baru') as HTMLInputElement).value).toBe('2999-10-05');
    expect((screen.getByLabelText('Jam mulai baru') as HTMLInputElement).value).toBe('15:30');
    expect((screen.getByLabelText('Jam selesai baru') as HTMLInputElement).value).toBe('17:00');
    expect(
      (document.querySelector('input[name="session_id"]') as HTMLInputElement).value
    ).toBe(SESSION_ID);
  });

  it('announces a success as a status', () => {
    mocks.rescheduleState.current = { success: true, message: 'Sesi berhasil di-reschedule.' };
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));

    expect(screen.getByRole('status').textContent).toContain('berhasil di-reschedule');
  });
});

describe('SubstituteTutorDialog', () => {
  function renderDialog(tutors = TUTORS) {
    mocks.which.current = 'substitute';
    return render(
      <SubstituteTutorDialog
        sessionId={SESSION_ID}
        sessionLabel="Sesi label"
        tutors={tutors}
        idPrefix="sched"
      />
    );
  }

  it('opens the dialog on trigger and returns focus on close', () => {
    renderDialog();
    const trigger = screen.getByRole('button', { name: 'Tutor pengganti' });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tutup dialog tutor pengganti' }));
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the member choice in the named select when the backend refuses', () => {
    mocks.substituteState.current = {
      success: false,
      message: 'Tutor pengganti tidak valid. Pilih tutor lain.',
    };
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Tutor pengganti' }));

    fireEvent.change(screen.getByLabelText('Tutor pengganti'), { target: { value: TUTOR_ID } });

    expect(screen.getByRole('alert').textContent).toContain('tidak valid');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByLabelText('Tutor pengganti') as HTMLSelectElement).value).toBe(TUTOR_ID);
    expect(
      (document.querySelector('input[name="session_id"]') as HTMLInputElement).value
    ).toBe(SESSION_ID);
  });

  it('announces a success as a status', () => {
    mocks.substituteState.current = {
      success: true,
      message: 'Tutor pengganti berhasil ditugaskan.',
    };
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Tutor pengganti' }));

    expect(screen.getByRole('status').textContent).toContain('berhasil ditugaskan');
  });

  it('renders its own empty state when the tutor list cannot be read', () => {
    renderDialog([]);
    fireEvent.click(screen.getByRole('button', { name: 'Tutor pengganti' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText('Tutor pengganti')).toBeNull();
    expect(dialog.textContent).toContain('Daftar tutor belum dapat dimuat');
    expect(
      (within(dialog).getByRole('button', { name: 'Tugaskan tutor pengganti' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
