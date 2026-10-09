// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnrollmentCancellationState } from '@/lib/enrollment-cancellation';

const mocks = vi.hoisted(() => ({ cancel: vi.fn() }));
vi.mock('../_actions/actions', () => ({ cancelPendingEnrollment: mocks.cancel }));

const { CancelEnrollmentButton } = await import('./CancelEnrollmentButton');
const enrollmentId = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';

beforeEach(() => {
  mocks.cancel.mockReset();
  // jsdom does not implement native dialog methods. Model their open/close events.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Batalkan pendaftaran' }));
  return screen.getByRole('dialog', { name: 'Batalkan pendaftaran ini?' }) as HTMLDialogElement;
}

describe('CancelEnrollmentButton', () => {
  it('keeps a refusal visible inside the open dialog and submits the enrollment ID', async () => {
    mocks.cancel.mockResolvedValue({ status: 'error', message: 'Enrollment tidak dapat dibatalkan.' });
    render(<CancelEnrollmentButton enrollmentId={enrollmentId} />);
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, batalkan' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Enrollment tidak dapat dibatalkan.');
    expect(dialog.open).toBe(true);
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
    expect((mocks.cancel.mock.calls[0][1] as FormData).get('enrollment_id')).toBe(enrollmentId);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tidak jadi' }));
    expect(dialog.open).toBe(false);
    expect(screen.queryByRole('alert', { hidden: true })).toBeNull();
  });

  it('closes after a successful action and announces success outside the dialog', async () => {
    mocks.cancel.mockResolvedValue({ status: 'success', message: 'Pendaftaran dibatalkan.' });
    render(<CancelEnrollmentButton enrollmentId={enrollmentId} />);
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, batalkan' }));
    expect((await screen.findByRole('status')).textContent).toBe('Pendaftaran dibatalkan.');
    expect(dialog.open).toBe(false);
    expect(dialog.contains(screen.getByRole('status'))).toBe(false);
  });

  it('disables confirmation while the action is pending', async () => {
    let resolve!: (state: EnrollmentCancellationState) => void;
    mocks.cancel.mockReturnValue(new Promise<EnrollmentCancellationState>((done) => { resolve = done; }));
    render(<CancelEnrollmentButton enrollmentId={enrollmentId} />);
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, batalkan' }));
    const pending = await within(dialog).findByRole('button', { name: 'Membatalkan…' });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    resolve({ status: 'success', message: 'Pendaftaran dibatalkan.' });
    await screen.findByRole('status');
  });
});
