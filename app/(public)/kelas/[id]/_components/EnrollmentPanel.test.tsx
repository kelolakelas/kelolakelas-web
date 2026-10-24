// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkoutPending: { current: false },
  enrollmentState: { current: { success: false, message: '' } as Record<string, unknown> },
  studentState: { current: { success: false, message: '' } as Record<string, unknown> },
  enrollInClass: vi.fn(),
  previewClassVoucher: vi.fn(async (): Promise<{ success: boolean; message: string; data?: { discount_amount: number; gross_amount: number } }> => ({ success: true, message: 'Preview voucher tersedia.', data: { discount_amount: 25000, gross_amount: 175000 } })),
  createScheduleRequest: vi.fn(),
  cancelScheduleRequest: vi.fn(),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
  enrollAction: { current: null as unknown as (prev: unknown, fd: unknown) => Promise<Record<string, unknown>> },
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: (action: unknown) => {
    if (action === mocks.createStudent || action === mocks.updateStudent) return [mocks.studentState.current, vi.fn()];
    // Capture the panel's dispatch wrapper (KEL-194): failing tests drive it
    // directly with a real FormData instead of overwriting the displayed
    // state, so the echo-restore path runs exactly as wired.
    mocks.enrollAction.current = action as (prev: unknown, fd: unknown) => Promise<Record<string, unknown>>;
    return [mocks.enrollmentState.current, vi.fn(), mocks.checkoutPending.current];
  },
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
  mocks.checkoutPending.current = false;
  window.sessionStorage.clear();
  mocks.enrollmentState.current = { success: false, message: '' };
  mocks.studentState.current = { success: false, message: '' };
  mocks.enrollInClass.mockReset();
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

describe('EnrollmentPanel preserves the last checkout submission after an error (KEL-194)', () => {
  const studentB = { id: '223e4567-e89b-12d3-a456-426614174002', parent_id: 'parent-1', first_name: 'Sari', date_of_birth: '2019-02-02' };
  const scheduleB = { id: '323e4567-e89b-12d3-a456-426614174003', label: 'Rabu 10.00', available: true };
  const key = '423e4567-e89b-12d3-a456-426614174004';

  function renderCheckout() {
    return render(
      <EnrollmentPanel
        classId={classId}
        classType="group"
        isParent
        students={[existingStudent, studentB]}
        schedules={[{ id: classId, label: 'Senin 09.00', available: true }, scheduleB]}
        idempotencyKey={key}
      />,
    );
  }

  function pickQuarterlyQris() {
    fireEvent.change(screen.getByRole('combobox', { name: 'Student' }), { target: { value: studentB.id } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Jadwal' }), { target: { value: scheduleB.id } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Periode pembayaran' }), { target: { value: 'quarterly' } });
    fireEvent.click(screen.getByRole('radio', { name: /QRIS/ }));
    fireEvent.change(screen.getByLabelText('Kode voucher (opsional)'), { target: { value: 'HEMAT' } });
  }

  function retryPayload() {
    const data = new FormData(screen.getByRole('button', { name: 'Lanjut ke pembayaran' }).closest('form')!);
    return Object.fromEntries([...data.entries()].map(([name, value]) => [name, String(value)]));
  }

  // KEL-194: drive the panel's real useActionState dispatch wrapper with the
  // live form's FormData (like a browser submit), then surface the returned
  // state the way an action completion would. Overwriting the mocked state
  // alone would bypass the echo-restore wiring under test.
  async function failThroughDispatch(values: Record<string, string>, message = 'Checkout belum tersedia karena layanan pembayaran sedang bermasalah. Coba lagi nanti.') {
    vi.mocked(mocks.enrollInClass).mockResolvedValueOnce({ success: false, message, values });
    const form = screen.getByRole('button', { name: 'Lanjut ke pembayaran' }).closest('form')!;
    let next: Record<string, unknown> = {};
    await act(async () => {
      next = await mocks.enrollAction.current({}, new FormData(form));
    });
    mocks.enrollmentState.current = next;
  }

  it('keeps quarterly+QRIS, voucher, and the idempotency key after a 5xx', async () => {
    const view = renderCheckout();
    pickQuarterlyQris();
    const payloadBefore = retryPayload();
    // Typing a voucher rotates the checkout key by design (new voucher = new
    // intent); the requirement is that the key then stays stable across the
    // failed submit and the retry.
    expect(payloadBefore.idempotency_key).toBeTruthy();
    expect(payloadBefore).toMatchObject({ student_id: studentB.id, schedule_id: scheduleB.id, billing_cycle: 'quarterly', payment_method: 'NQ', voucher_code: 'HEMAT' });

    await failThroughDispatch({ student_id: studentB.id, schedule_id: scheduleB.id, billing_cycle: 'quarterly', payment_method: 'NQ', voucher_code: 'HEMAT' });
    view.rerender(
      <EnrollmentPanel classId={classId} classType="group" isParent students={[existingStudent, studentB]} schedules={[{ id: classId, label: 'Senin 09.00', available: true }, scheduleB]} idempotencyKey={key} />,
    );

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('layanan pembayaran'));
    expect((screen.getByRole('combobox', { name: 'Student' }) as HTMLSelectElement).value).toBe(studentB.id);
    expect((screen.getByRole('combobox', { name: 'Jadwal' }) as HTMLSelectElement).value).toBe(scheduleB.id);
    expect((screen.getByRole('combobox', { name: 'Periode pembayaran' }) as HTMLSelectElement).value).toBe('quarterly');
    expect((screen.getByRole('radio', { name: /QRIS/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Kode voucher (opsional)') as HTMLInputElement).value).toBe('HEMAT');
    // Retry carries the identical intent on the same idempotency key.
    expect(retryPayload()).toEqual(payloadBefore);
  });

  it('keeps yearly+VA after a 409 without reverting to monthly/VC', async () => {
    const view = renderCheckout();
    fireEvent.change(screen.getByRole('combobox', { name: 'Student' }), { target: { value: existingStudent.id } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Jadwal' }), { target: { value: classId } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Periode pembayaran' }), { target: { value: 'yearly' } });
    fireEvent.click(screen.getByRole('radio', { name: /Virtual Account/ }));

    await failThroughDispatch(
      { student_id: existingStudent.id, schedule_id: classId, billing_cycle: 'yearly', payment_method: 'VA', voucher_code: '' },
      'Jadwal penuh atau enrollment ini sudah berubah. Pilih jadwal lain atau gunakan checkout yang sama.',
    );
    view.rerender(
      <EnrollmentPanel classId={classId} classType="group" isParent students={[existingStudent, studentB]} schedules={[{ id: classId, label: 'Senin 09.00', available: true }, scheduleB]} idempotencyKey={key} />,
    );

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Jadwal penuh'));
    expect((screen.getByRole('combobox', { name: 'Periode pembayaran' }) as HTMLSelectElement).value).toBe('yearly');
    expect((screen.getByRole('radio', { name: /Virtual Account/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: /Kartu kredit\/debit/ }) as HTMLInputElement).checked).toBe(false);
    expect(retryPayload()).toMatchObject({ billing_cycle: 'yearly', payment_method: 'VA', idempotency_key: key });
  });

  it('shows an explicit fallback when the echoed student or schedule is no longer offered', async () => {
    // The student list is seeded once per mount, so the "latest fetch no
    // longer carries the last submission" case is a fresh mount whose echoed
    // state names ids absent from the current options.
    const view = render(
      <EnrollmentPanel classId={classId} classType="group" isParent students={[existingStudent]} schedules={[{ id: classId, label: 'Senin 09.00', available: true }]} idempotencyKey={key} />,
    );
    await failThroughDispatch(
      { student_id: studentB.id, schedule_id: scheduleB.id, billing_cycle: 'quarterly', payment_method: 'NQ', voucher_code: '' },
      'Kelas atau student tidak ditemukan. Muat ulang halaman lalu coba lagi.',
    );
    view.rerender(
      <EnrollmentPanel classId={classId} classType="group" isParent students={[existingStudent]} schedules={[{ id: classId, label: 'Senin 09.00', available: true }]} idempotencyKey={key} />,
    );
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('tidak ditemukan'));
    expect(screen.getByRole('option', { name: /pilih student baru/i })).toBeTruthy();
    expect(screen.getByRole('option', { name: /pilih jadwal baru/i })).toBeTruthy();
    // Cycle and method are still the parent's own choices, not silent defaults.
    expect((screen.getByRole('combobox', { name: 'Periode pembayaran' }) as HTMLSelectElement).value).toBe('quarterly');
    expect((screen.getByRole('radio', { name: /QRIS/ }) as HTMLInputElement).checked).toBe(true);
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


describe('checkout recovery after reload (KEL-216)', () => {
  const parentId = '923e4567-e89b-42d3-a456-426614174000';
  const originalKey = '723e4567-e89b-42d3-a456-426614174000';
  const nextPageKey = '823e4567-e89b-42d3-a456-426614174000';
  const panel = (key: string, owner = parentId, available = true) => <EnrollmentPanel parentId={owner} classId={classId} classType="group" isParent students={[existingStudent]} schedules={[{ id: classId, label: 'Senin 09.00', available }]} idempotencyKey={key} />;

  it('disables duplicate submission while the manually dispatched action is pending', () => {
    mocks.checkoutPending.current = true;
    render(panel(originalKey));
    const button = screen.getByRole('button', { name: 'Menyiapkan checkout…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('restores the same payload/key after remount and permits same-key retry of a now-full reserved slot', () => {
    const first = render(panel(originalKey));
    fireEvent.change(screen.getByLabelText('Student'), { target: { value: classId } });
    fireEvent.change(screen.getByLabelText('Jadwal'), { target: { value: classId } });
    fireEvent.change(screen.getByLabelText('Periode pembayaran'), { target: { value: 'quarterly' } });
    fireEvent.click(screen.getByRole('radio', { name: /QRIS/ }));
    const form = screen.getByRole('button', { name: 'Lanjut ke pembayaran' }).closest('form')!;
    const original = Object.fromEntries(new FormData(form).entries());
    fireEvent.submit(form);
    first.unmount();
    render(panel(nextPageKey, parentId, false));
    const retry = screen.getByRole('button', { name: 'Lanjut ke pembayaran' }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    expect(Object.fromEntries(new FormData(retry.closest('form')!).entries())).toEqual(original);
  });

  it('starts a distinct attempt for another student and can return to the original draft before submitting', () => {
    const key = `kelolakelas:checkout:v1:${parentId}:${classId}`;
    window.sessionStorage.setItem(key, JSON.stringify({ key: originalKey, values: { student_id: classId, schedule_id: classId, billing_cycle: 'monthly', payment_method: 'VA', voucher_code: '' } }));
    const second = { ...existingStudent, id: '523e4567-e89b-42d3-a456-426614174000', first_name: 'Second' };
    render(<EnrollmentPanel parentId={parentId} classId={classId} classType="group" isParent students={[existingStudent, second]} schedules={[{ id: classId, label: 'Senin', available: true }]} idempotencyKey={nextPageKey} />);
    fireEvent.change(screen.getByLabelText('Student'), { target: { value: second.id } });
    expect((document.querySelector('[name=idempotency_key]') as HTMLInputElement).value).not.toBe(originalKey);
    fireEvent.change(screen.getByLabelText('Student'), { target: { value: classId } });
    expect((document.querySelector('[name=idempotency_key]') as HTMLInputElement).value).toBe(originalKey);
  });

  it('does not restore another parent’s attempt or an invalid stored payload', () => {
    const key = `kelolakelas:checkout:v1:${parentId}:${classId}`;
    window.sessionStorage.setItem(key, JSON.stringify({ key: originalKey, values: { student_id: classId, schedule_id: classId, billing_cycle: 'monthly', payment_method: 'VA', voucher_code: '' } }));
    const view = render(panel(nextPageKey, '623e4567-e89b-42d3-a456-426614174000'));
    expect((screen.getByLabelText('Student') as HTMLSelectElement).value).toBe('');
    view.unmount();
    window.sessionStorage.setItem(key, '{invalid-json');
    render(panel(nextPageKey));
    expect((document.querySelector('[name=idempotency_key]') as HTMLInputElement).value).toBe(nextPageKey);
  });

  it('warns when storage is unavailable while retaining the in-tab form and identity', async () => {
    const view = render(panel(originalKey));
    fireEvent.change(screen.getByLabelText('Student'), { target: { value: classId } });
    fireEvent.change(screen.getByLabelText('Jadwal'), { target: { value: classId } });
    const fail = vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue({ getItem: () => null, setItem: () => { throw new Error('storage denied'); } } as unknown as Storage);
    fireEvent.submit(screen.getByRole('button', { name: 'Lanjut ke pembayaran' }).closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Jangan muat ulang'));
    expect((document.querySelector('[name=idempotency_key]') as HTMLInputElement).value).toBe(originalKey);
    fail.mockRestore();
    view.unmount();
  });
});
