// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enrollmentState: { current: { success: false, message: '' } as Record<string, unknown> },
  studentState: { current: { success: false, message: '' } as Record<string, unknown> },
  enrollInClass: vi.fn(),
  previewClassVoucher: vi.fn(async (): Promise<{ success: boolean; message: string; data?: { discount_amount: number; gross_amount: number } }> => ({ success: true, message: 'Preview voucher tersedia.', data: { discount_amount: 25000, gross_amount: 175000 } })),
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
  previewClassVoucher: mocks.previewClassVoucher,
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

  it('shows the optional voucher field only on the group checkout and previews discount and total', async () => {
    const view = renderGroup();
    const field = screen.getByLabelText('Kode voucher (opsional)') as HTMLInputElement;
    expect(field.value).toBe('');
    fireEvent.change(field, { target: { value: 'HEMAT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Periksa voucher' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Preview voucher tersedia.'));
    expect(screen.getByText('Diskon voucher')).toBeTruthy();
    expect(screen.getByText('Rp 25.000')).toBeTruthy();
    expect(screen.getByText('Total preview')).toBeTruthy();
    expect(screen.getByText('Rp 175.000')).toBeTruthy();
    expect(mocks.previewClassVoucher).toHaveBeenCalledWith(classId, 'HEMAT');
    view.rerender(<EnrollmentPanel classId={classId} classType="private" isParent students={[existingStudent]} schedules={[]} idempotencyKey={classId} />);
    expect(screen.queryByLabelText('Kode voucher (opsional)')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Periksa voucher' })).toBeNull();
  });

  it('invalidates the preview when the voucher code changes and refreshes the checkout key', async () => {
    renderGroup();
    const field = screen.getByLabelText('Kode voucher (opsional)') as HTMLInputElement;
    const initialKey = (document.querySelector('input[name="idempotency_key"]') as HTMLInputElement).value;
    fireEvent.change(field, { target: { value: 'HEMAT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Periksa voucher' }));
    await waitFor(() => expect(screen.getByText('Rp 25.000')).toBeTruthy());
    fireEvent.change(field, { target: { value: 'HEMAT10' } });
    expect(screen.queryByText('Rp 25.000')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    const rotatedKey = (document.querySelector('input[name="idempotency_key"]') as HTMLInputElement).value;
    expect(rotatedKey).not.toBe(initialKey);
  });

  it('renders a clear Indonesian refusal when the preview is rejected', async () => {
    vi.mocked(mocks.previewClassVoucher).mockResolvedValueOnce({ success: false, message: 'Voucher ditolak atau kuotanya sudah habis. Hapus kode voucher lalu checkout ulang tanpa voucher untuk membuat invoice pengganti. Invoice sebelumnya tidak berubah.' });
    renderGroup();
    fireEvent.change(screen.getByLabelText('Kode voucher (opsional)'), { target: { value: 'HABIS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Periksa voucher' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('checkout ulang tanpa voucher');
    expect(alert.textContent).toContain('invoice pengganti');
  });
});

describe('EnrollmentPanel add student with existing students (KEL-130)', () => {
  function rerenderWithStudents(view: ReturnType<typeof render>, items: unknown[], classType: 'group' | 'private' = 'group') {
    view.rerender(
      <EnrollmentPanel
        classId={classId}
        classType={classType}
        isParent
        students={items as never}
        schedules={classType === 'group' ? [{ id: classId, label: 'Senin 09.00', available: true }] : []}
        idempotencyKey={classId}
      />
    );
  }

  it('group: shows the add-student trigger next to the checkout form and opens the dialog without navigating', async () => {
    renderGroup();
    const url = window.location.href;
    const trigger = screen.getByRole('button', { name: 'Tambah student' });

    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lanjut ke pembayaran' })).toBeTruthy();
    expect(window.location.href).toBe(url);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/Nama depan/)));
  });

  it('group: success appends the option, selects the new student, closes, and returns focus', async () => {
    const view = renderGroup();
    const url = window.location.href;
    const select = screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: existingStudent.id } });
    const trigger = screen.getByRole('button', { name: 'Tambah student' });
    fireEvent.click(trigger);

    mocks.studentState.current = { success: true, message: 'Profil student berhasil dibuat.', data: createdStudent };
    rerenderWithStudents(view, [existingStudent]);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement).value).toBe(createdStudent.id);
    expect(screen.getByRole('option', { name: 'Budi' })).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
    expect(window.location.href).toBe(url);
  });

  it('group: cancel keeps the previous selection and returns focus to the trigger', async () => {
    renderGroup();
    const select = screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: existingStudent.id } });
    const trigger = screen.getByRole('button', { name: 'Tambah student' });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement).value).toBe(existingStudent.id);
    expect(document.activeElement).toBe(trigger);
  });

  it('group: failed create keeps the dialog open and the previous selection, focus returns on close', async () => {
    const view = renderGroup();
    const select = screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: existingStudent.id } });
    const trigger = screen.getByRole('button', { name: 'Tambah student' });
    fireEvent.click(trigger);

    mocks.studentState.current = { success: false, message: 'Layanan student sedang tidak tersedia. Coba lagi nanti.' };
    rerenderWithStudents(view, [existingStudent]);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement).value).toBe(existingStudent.id);
    expect(screen.getByRole('alert').textContent).toContain('Layanan student sedang tidak tersedia.');

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect((screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement).value).toBe(existingStudent.id);
  });

  it('private: success selects the new student in the schedule request form without leaving the page', async () => {
    const view = renderWithStudents([existingStudent]);
    const url = window.location.href;
    const trigger = screen.getByRole('button', { name: 'Tambah student' });
    fireEvent.click(trigger);

    mocks.studentState.current = { success: true, message: 'Profil student berhasil dibuat.', data: createdStudent };
    rerenderWithStudents(view, [existingStudent], 'private');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement).value).toBe(createdStudent.id);
    expect(screen.getByRole('option', { name: 'Budi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kirim permintaan jadwal' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lanjut ke pembayaran' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(window.location.href).toBe(url);
  });

  it('private: cancel keeps the schedule request selection and returns focus to the trigger', async () => {
    renderWithStudents([existingStudent]);
    const formSelect = screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement;
    fireEvent.change(formSelect, { target: { value: existingStudent.id } });
    const trigger = screen.getByRole('button', { name: 'Tambah student' });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement).value).toBe(existingStudent.id);
    expect(document.activeElement).toBe(trigger);
  });
});
