// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enrollmentState: { current: { success: false, message: '' } as Record<string, unknown> },
  studentState: { current: { success: false, message: '' } as Record<string, unknown> },
  enrollInClass: vi.fn(),
  createScheduleRequest: vi.fn(),
  cancelScheduleRequest: vi.fn(),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: (action: unknown) => action === mocks.createStudent || action === mocks.updateStudent
    ? [mocks.studentState.current, vi.fn()]
    : [mocks.enrollmentState.current, vi.fn()],
}));
vi.mock('react-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-dom')>()),
  useFormStatus: () => ({ pending: false }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock('../_actions/actions', () => ({
  enrollInClass: mocks.enrollInClass,
  createScheduleRequest: mocks.createScheduleRequest,
  cancelScheduleRequest: mocks.cancelScheduleRequest,
}));
vi.mock('@/app/(dashboard)/dashboard/parent/students/_actions/actions', () => ({
  createStudent: mocks.createStudent,
  updateStudent: mocks.updateStudent,
}));

const { EnrollmentPanel } = await import('./EnrollmentPanel');
const { duplicateEnrollmentState } = await import('@/lib/enrollment');

const classId = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const existingStudent = { id: classId, parent_id: 'parent-1', first_name: 'Ana', date_of_birth: '2018-01-01' };
const createdStudent = { id: 'student-created', parent_id: 'parent-1', first_name: 'Budi', date_of_birth: '2019-02-02' };

function renderWithStudents(items: unknown[] = []) {
  return render(<EnrollmentPanel classId={classId} classType="private" isParent students={items as never} schedules={[]} idempotencyKey={classId} />);
}

function renderGroup() {
  return render(<EnrollmentPanel classId={classId} classType="group" isParent students={[existingStudent]} schedules={[{ id: classId, label: 'Senin 09.00', available: true }]} idempotencyKey={classId} />);
}

beforeEach(() => {
  mocks.enrollmentState.current = { success: false, message: '' };
  mocks.studentState.current = { success: false, message: '' };
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) { this.open = true; },
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

describe('EnrollmentPanel', () => {
  it('opens the student dialog, focuses the first field, and keeps the URL stable', async () => {
    renderWithStudents();
    const url = window.location.href;

    fireEvent.click(screen.getByRole('button', { name: 'Tambah student' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(window.location.href).toBe(url);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/Nama depan/)));
  });

  it('closes on cancel and returns focus to the trigger', async () => {
    renderWithStudents();
    const url = window.location.href;
    const trigger = screen.getByRole('button', { name: 'Tambah student' });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(window.location.href).toBe(url);
  });

  it('closes on Escape/cancel and returns focus to the trigger', async () => {
    renderWithStudents();
    const trigger = screen.getByRole('button', { name: 'Tambah student' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');

    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps the modal open when validation or API errors are returned', async () => {
    const view = renderWithStudents();
    fireEvent.click(screen.getByRole('button', { name: 'Tambah student' }));

    mocks.studentState.current = {
      success: false,
      message: 'Periksa kembali field student yang ditandai.',
      errors: { first_name: ['Nama depan wajib diisi'] },
    };
    view.rerender(<EnrollmentPanel classId={classId} classType="private" isParent students={[]} schedules={[]} idempotencyKey={classId} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Periksa kembali field student yang ditandai.');

    mocks.studentState.current = { success: false, message: 'Layanan student sedang tidak tersedia. Coba lagi nanti.' };
    view.rerender(<EnrollmentPanel classId={classId} classType="private" isParent students={[]} schedules={[]} idempotencyKey={classId} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Layanan student sedang tidak tersedia.');
  });

  it('closes after success, selects the returned student, and keeps the URL stable', async () => {
    const view = renderWithStudents();
    const url = window.location.href;
    fireEvent.click(screen.getByRole('button', { name: 'Tambah student' }));

    mocks.studentState.current = { success: true, message: 'Profil student berhasil dibuat.', data: createdStudent };
    view.rerender(<EnrollmentPanel classId={classId} classType="private" isParent students={[]} schedules={[]} idempotencyKey={classId} />);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement).value).toBe(createdStudent.id);
    expect(screen.getByRole('option', { name: 'Budi' })).toBeTruthy();
    expect(window.location.href).toBe(url);
  });

  it('shows the existing enrollment errors without changing their links', () => {
    mocks.enrollmentState.current = duplicateEnrollmentState;
    renderWithStudents([existingStudent]);

    expect(screen.getByRole('alert').textContent).toContain('Student ini sudah terdaftar');
    expect(screen.getByRole('link', { name: 'Lihat status enrollment' }).getAttribute('href')).toBe('/dashboard/parent/enrollments');
  });

  it('offers a labelled native keyboard-focusable channel group and no card fields', () => {
    renderGroup();
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((radio) => radio.value)).toEqual(['VC', 'VA', 'NQ']);
    expect((screen.getByRole('group', { name: 'Metode pembayaran' }) as HTMLFieldSetElement).contains(radios[0])).toBe(true);
    expect(screen.getByRole('radio', { name: /Kartu kredit\/debit/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Virtual Account/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /QRIS/ })).toBeTruthy();
    expect(radios[0].checked).toBe(true);
    radios[1].focus();
    expect(document.activeElement).toBe(radios[1]);
    fireEvent.click(radios[1]);
    expect(radios[1].checked).toBe(true);
    expect(screen.queryByLabelText(/card number|cvv|cvc/i)).toBeNull();
  });

  it('displays VA details after a successful checkout without leaving the page', () => {
    mocks.enrollmentState.current = { success: true, message: 'Enrollment tersimpan.', payment: { channel: 'VA', merchantOrderId: classId, amount: 150000, currency: 'IDR', expiresAt: '2100-01-01T00:00:00Z', instructions: { kind: 'va', channelLabel: 'Virtual Account', vaNumber: '88001234', expiresLabel: '1 Jan 2100' }, qrImage: null } };
    renderGroup();
    expect(screen.getByTestId('va-number').textContent).toBe('88001234');
    expect(screen.getByRole('link', { name: 'Periksa status pembayaran' }).getAttribute('href')).toContain(classId);
  });

  it('shows the safe fallback when billing omitted instructions', () => {
    mocks.enrollmentState.current = { success: true, message: 'Enrollment tersimpan.', payment: { channel: 'NQ', merchantOrderId: null, instructions: null, qrImage: null } };
    renderGroup();
    expect(screen.getByText(/Instruksi pembayaran belum tersedia/)).toBeTruthy();
    expect(screen.queryByTestId('qris-image')).toBeNull();
  });
});
