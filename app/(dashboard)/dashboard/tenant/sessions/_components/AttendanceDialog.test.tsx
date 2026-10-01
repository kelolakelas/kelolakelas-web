// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  actionState: { current: { success: false, message: '', results: [], forbidden: false } as Record<string, unknown> },
  saveSessionAttendance: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: () => [mocks.actionState.current, vi.fn()],
}));
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  useFormStatus: () => ({ pending: false }),
}));
vi.mock('../_actions/attendance', () => ({
  saveSessionAttendance: mocks.saveSessionAttendance,
}));

/**
 * Interaction tests for the mass attendance dialog (KEL-137).
 *
 * The Server Action is stubbed through `useActionState`, so what is
 * asserted is the dialog contract the acceptance criteria depend on:
 *
 * - every attendee is a `fieldset` whose `legend` is the student name, with
 *   four native radios: Tab moves between students, arrow keys move within
 *   one student's statuses, and the checked status is exposed through the
 *   native radio semantics a screen reader already understands,
 * - the member opens the dialog from the trigger and focus returns to it on
 *   close, so keyboard users do not lose their place in the session list,
 * - a refusal keeps the dialog open with the action message where the
 *   member is already looking, announced as an alert, while a success is
 *   announced as a status,
 * - the forbidden state renders the permission panel instead of the form,
 * - the hidden entries carry exactly what the radios show, including a
 *   change the member just made.
 */

const { AttendanceDialog } = await import('./AttendanceDialog');

const SESSION_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const ENROLLMENT_ID = 'c0ffee00-1111-4222-8333-444455556666';
const SECOND_ENROLLMENT_ID = 'd1ffee00-1111-4222-8333-444455556666';

const ATTENDEES = [
  { enrollment_id: ENROLLMENT_ID, student: { first_name: 'Ayu', last_name: 'Lestari' } },
  { enrollment_id: SECOND_ENROLLMENT_ID, student: { first_name: 'Budi', last_name: null } },
];

function renderDialog(attendance = new Map()) {
  return render(
    <AttendanceDialog
      sessionId={SESSION_ID}
      sessionLabel="Rabu, 30 September 2026 · 15:30–17:00"
      attendees={ATTENDEES}
      attendance={attendance}
      idPrefix="test"
    />
  );
}

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Catat kehadiran' }));
}

beforeEach(() => {
  mocks.actionState.current = { success: false, message: '', results: [], forbidden: false };
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

describe('AttendanceDialog', () => {
  it('opens the dialog on trigger and returns focus on close', () => {
    renderDialog();
    const trigger = screen.getByRole('button', { name: 'Catat kehadiran' });
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tutup dialog kehadiran' }));
    expect(document.activeElement).toBe(trigger);
  });

  it('renders one labelled radio group per attendee', () => {
    renderDialog();
    openDialog();

    const dialog = screen.getByRole('dialog');

    for (const name of ['Ayu Lestari', 'Budi']) {
      const group = within(dialog).getByRole('group', { name });
      const radios = within(group).getAllByRole('radio');

      expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual([
        'present',
        'late',
        'excused',
        'absent',
      ]);
      // The label text is the status a screen reader announces.
      for (const label of ['Hadir', 'Telat', 'Izin', 'Alfa']) {
        expect(within(group).getByRole('radio', { name: label })).toBeTruthy();
      }
    }

    // Each student's radios share a name, so arrow keys stay within the
    // student and Tab moves to the next one.
    const firstRadios = within(within(dialog).getByRole('group', { name: 'Ayu Lestari' })).getAllByRole('radio');
    const names = new Set(firstRadios.map((radio) => (radio as HTMLInputElement).name));
    expect(names.size).toBe(1);

    const secondRadios = within(within(dialog).getByRole('group', { name: 'Budi' })).getAllByRole('radio');
    expect((secondRadios[0] as HTMLInputElement).name).not.toBe(
      (firstRadios[0] as HTMLInputElement).name
    );
  });

  it('starts unrecorded rows at Hadir and keeps the recorded status', () => {
    renderDialog(
      new Map([
        [ENROLLMENT_ID, { id: 'att-1', enrollment_id: ENROLLMENT_ID, session_id: SESSION_ID, status: 'late' }],
      ])
    );
    openDialog();

    const dialog = screen.getByRole('dialog');
    const ayuRadios = within(within(dialog).getByRole('group', { name: 'Ayu Lestari' })).getAllByRole('radio');
    const budiRadios = within(within(dialog).getByRole('group', { name: 'Budi' })).getAllByRole('radio');

    expect((ayuRadios.find((radio) => (radio as HTMLInputElement).value === 'late') as HTMLInputElement).checked).toBe(true);
    expect((budiRadios.find((radio) => (radio as HTMLInputElement).value === 'present') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Tercatat:').parentElement?.textContent).toContain('Telat');
  });

  it('serialises the radio states into the hidden entries field', () => {
    renderDialog();
    openDialog();

    const entries = document.querySelector('input[name="entries"]') as HTMLInputElement;
    expect(JSON.parse(entries.value)).toEqual([
      { enrollment_id: ENROLLMENT_ID, status: 'present' },
      { enrollment_id: SECOND_ENROLLMENT_ID, status: 'present' },
    ]);

    const dialog = screen.getByRole('dialog');
    const budiGroup = within(within(dialog).getByRole('group', { name: 'Budi' }));
    fireEvent.click(budiGroup.getByRole('radio', { name: 'Izin' }));

    expect(JSON.parse(entries.value)).toEqual([
      { enrollment_id: ENROLLMENT_ID, status: 'present' },
      { enrollment_id: SECOND_ENROLLMENT_ID, status: 'excused' },
    ]);

    expect(document.querySelector('input[name="session_id"]') as HTMLInputElement).not.toBeNull();
    expect((document.querySelector('input[name="session_id"]') as HTMLInputElement).value).toBe(SESSION_ID);
  });

  it('keeps the dialog open with the refusal announced as an alert', () => {
    mocks.actionState.current = {
      success: false,
      message: 'Sebagian kehadiran tersimpan (1 siswa), 1 siswa gagal.',
      results: [
        { enrollmentId: ENROLLMENT_ID, outcome: 'saved', message: null },
        { enrollmentId: SECOND_ENROLLMENT_ID, outcome: 'failed', message: 'Kehadiran belum dapat disimpan. Coba lagi nanti.' },
      ],
      forbidden: false,
    };
    renderDialog();
    openDialog();

    expect(screen.getByRole('alert').textContent).toContain('Sebagian kehadiran tersimpan');
    expect(screen.getByRole('dialog')).toBeTruthy();
    // The per-row failure is announced where the member is already looking.
    expect(screen.getByText('Kehadiran belum dapat disimpan. Coba lagi nanti.')).toBeTruthy();
  });

  it('announces a success as a status', () => {
    mocks.actionState.current = {
      success: true,
      message: 'Kehadiran tersimpan untuk 2 siswa.',
      results: [
        { enrollmentId: ENROLLMENT_ID, outcome: 'saved', message: null },
        { enrollmentId: SECOND_ENROLLMENT_ID, outcome: 'saved', message: null },
      ],
      forbidden: false,
    };
    renderDialog();
    openDialog();

    expect(screen.getByRole('status').textContent).toContain('Kehadiran tersimpan untuk 2 siswa.');
  });

  it('renders the forbidden panel instead of the form without attendance:create', () => {
    mocks.actionState.current = {
      success: false,
      message: 'Anda tidak memiliki izin mencatat kehadiran. Hubungi administrator tenant untuk mendapatkan permission attendance:create.',
      results: [],
      forbidden: true,
    };
    renderDialog();
    openDialog();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('alert').textContent).toContain('attendance:create');
    expect(within(dialog).queryByRole('group')).toBeNull();
  });
});
