// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestState: { current: { success: false, message: '' } as Record<string, unknown> },
  cancelState: { current: { success: false, message: '' } as Record<string, unknown> },
  enrollmentState: { current: { success: false, message: '' } as Record<string, unknown> },
  studentState: { current: { success: false, message: '' } as Record<string, unknown> },
  createScheduleRequest: vi.fn(),
  cancelScheduleRequest: vi.fn(),
  enrollInClass: vi.fn(),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: (action: unknown) => {
    if (action === mocks.createStudent || action === mocks.updateStudent) return [mocks.studentState.current, vi.fn()];
    if (action === mocks.createScheduleRequest) return [mocks.requestState.current, vi.fn()];
    if (action === mocks.cancelScheduleRequest) return [mocks.cancelState.current, vi.fn()];
    return [mocks.enrollmentState.current, vi.fn()];
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
  createScheduleRequest: mocks.createScheduleRequest,
  cancelScheduleRequest: mocks.cancelScheduleRequest,
}));
vi.mock('@/app/(dashboard)/dashboard/parent/students/_actions/actions', () => ({
  createStudent: mocks.createStudent,
  updateStudent: mocks.updateStudent,
}));

const { EnrollmentPanel } = await import('./EnrollmentPanel');

const classId = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const studentId = '7c2e4d1b-5b8f-4d2e-8d3f-7a1c9e6b4f22';
const otherStudentId = '5f4e3d2c-1b0a-4f9e-8d7c-6b5a4f3e2d1c';
const students = [{ id: studentId, parent_id: 'parent-1', first_name: 'Ana', date_of_birth: '2018-01-01' }];
const schedule = { id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f', label: 'Senin, 16:00–17:30', available: true };

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: '9a1c3e5f-2b4d-4e6f-8a0b-1c2d3e4f5a6b',
    class_id: classId,
    student_id: studentId,
    billing_cycle: 'monthly',
    slots: [{ day_of_week: 1, start_time: '16:00', end_time: '17:30' }],
    note: null,
    status: 'pending',
    rejection_reason: null,
    decided_at: null,
    ...overrides,
  };
}

function renderPrivate(extra: { scheduleRequests?: unknown[]; enrollments?: unknown[] } = {}) {
  return render(
    <EnrollmentPanel
      classId={classId}
      classType="private"
      isParent
      students={students as never}
      schedules={[]}
      idempotencyKey={classId}
      scheduleRequests={(extra.scheduleRequests ?? []) as never}
      enrollments={(extra.enrollments ?? []) as never}
    />
  );
}

function renderGroup() {
  return render(
    <EnrollmentPanel
      classId={classId}
      classType="group"
      isParent
      students={students as never}
      schedules={[schedule]}
      idempotencyKey={classId}
    />
  );
}

beforeEach(() => {
  mocks.requestState.current = { success: false, message: '' };
  mocks.cancelState.current = { success: false, message: '' };
  mocks.enrollmentState.current = { success: false, message: '' };
  mocks.studentState.current = { success: false, message: '' };
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  } else {
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  }
});

afterEach(() => cleanup());

describe('EnrollmentPanel private vs group (KEL-109)', () => {
  it('shows the schedule request form on a private class, never the checkout button', () => {
    renderPrivate();

    expect(screen.getByRole('heading', { name: 'Ajukan jadwal les private' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kirim permintaan jadwal' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lanjut ke pembayaran' })).toBeNull();
    expect(screen.getByText('Slot jadwal yang diajukan')).toBeTruthy();
    expect(screen.getByText('Belum ada permintaan jadwal untuk kelas ini.')).toBeTruthy();
  });

  it('keeps the checkout flow on a group class', () => {
    renderGroup();

    expect(screen.getByRole('heading', { name: 'Pilih student dan jadwal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lanjut ke pembayaran' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Kirim permintaan jadwal' })).toBeNull();
  });

  it('rejects a slot whose end is not after its start before sending', () => {
    const { container } = renderPrivate();
    const form = container.querySelector('#form-permintaan-jadwal form');
    if (!form) throw new Error('schedule request form not rendered');

    fireEvent.change(screen.getByLabelText('Jam mulai'), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText('Jam selesai'), { target: { value: '17:30' } });
    fireEvent.submit(form);

    expect(screen.getByRole('alert').textContent).toContain('setelah jam mulai');
  });

  it('links a duplicate error to the request list', () => {
    mocks.requestState.current = {
      success: false,
      message: 'Permintaan sebelumnya untuk student ini masih menunggu peninjauan.',
      link: { href: `/kelas/${classId}#daftar-permintaan-jadwal`, label: 'Lihat daftar permintaan' },
    };
    renderPrivate();

    expect(screen.getByRole('alert').textContent).toContain('masih menunggu');
    expect(screen.getByRole('link', { name: 'Lihat daftar permintaan' }).getAttribute('href')).toBe(
      `/kelas/${classId}#daftar-permintaan-jadwal`
    );
  });
});

describe('ScheduleRequestList statuses (KEL-109)', () => {
  it('offers cancellation for a pending request', () => {
    renderPrivate({ scheduleRequests: [request()] });

    expect(screen.getByText('Menunggu peninjauan')).toBeTruthy();
    expect(screen.getByText('Senin, 16:00–17:30')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Batalkan permintaan' })).toBeTruthy();
  });

  it('shows the tenant reason and a resubmit option for a rejected request', () => {
    renderPrivate({
      scheduleRequests: [request({ status: 'rejected', rejection_reason: 'Slot penuh, usulkan hari lain.' })],
    });

    expect(screen.getByText('Ditolak')).toBeTruthy();
    expect(screen.getByText(/Alasan penolakan: Slot penuh/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ajukan ulang' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Batalkan permintaan' })).toBeNull();
  });

  it('refills the form when a rejected request is resubmitted', () => {
    renderPrivate({
      scheduleRequests: [request({ status: 'rejected', rejection_reason: 'Slot penuh, usulkan hari lain.' })],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ajukan ulang' }));

    expect(screen.getByText(/Slot sebelumnya sudah diisi ulang/)).toBeTruthy();
    expect(screen.getByDisplayValue('17:30')).toBeTruthy();
  });

  it('links an approved request to its enrollment when a matching row is loaded', () => {
    renderPrivate({
      scheduleRequests: [request({ status: 'approved' })],
      enrollments: [{ id: 'enrollment-1', student_id: studentId, class_id: classId }],
    });

    expect(screen.getByText('Disetujui')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lihat enrollment' }).getAttribute('href')).toBe(
      '/dashboard/parent/enrollments#enrollment-enrollment-1'
    );
  });

  it('shows an approved request without a link when no enrollment row matches', () => {
    renderPrivate({ scheduleRequests: [request({ status: 'approved' })], enrollments: [] });

    expect(screen.getByText('Disetujui')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Lihat enrollment' })).toBeNull();
    expect(screen.getByText(/akan muncul di halaman status enrollment/)).toBeTruthy();
  });

  it('shows a cancelled request with no further action', () => {
    renderPrivate({ scheduleRequests: [request({ status: 'cancelled' })] });

    expect(screen.getByText('Dibatalkan')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Batalkan permintaan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ajukan ulang' })).toBeNull();
  });

  it('shows only this parent\u2019s requests for the class being viewed', () => {
    renderPrivate({
      scheduleRequests: [request(), request({ id: otherStudentId, student_id: otherStudentId })],
    });

    expect(screen.getAllByText('Senin, 16:00–17:30')).toHaveLength(2);
    expect(screen.getByText('Permintaan jadwal Anda')).toBeTruthy();
  });
});
