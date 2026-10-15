// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ENROLLMENT_CANCELLATION_SUCCESS_MESSAGE } from '@/lib/enrollment-cancellation';

const mocks = vi.hoisted(() => ({ history: vi.fn(), cancel: vi.fn() }));
vi.mock('./_queries/queries', () => ({ getEnrollmentHistory: mocks.history }));
vi.mock('./_actions/actions', () => ({ cancelPendingEnrollment: mocks.cancel }));
const { default: Page } = await import('./page');
const id = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';

function history(enrollmentStatus: string, transactionStatus: string) {
  return { error: null, data: {
    enrollments: [{ id, status: enrollmentStatus, class: { name: 'Algebra' } }],
    transactions: [{ id: 'tx-1', enrollment_id: id, status: transactionStatus }],
  } };
}

beforeEach(() => {
  vi.resetAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});
afterEach(cleanup);

it.each(['before', 'after'])('keeps success visible when server row updates %s action resolution (KEL-178)', async (timing) => {
  mocks.history.mockResolvedValue(history('pending', 'pending'));
  let resolve!: (value: { status: 'success'; message: string }) => void;
  mocks.cancel.mockReturnValue(new Promise((done) => { resolve = done; }));
  const view = render(await Page());
  fireEvent.click(view.getByRole('button', { name: 'Batalkan pendaftaran' }));
  const dialog = view.getByRole('dialog', { name: 'Batalkan pendaftaran ini?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, batalkan' }));
  await within(dialog).findByRole('button', { name: 'Membatalkan…' });
  const refresh = async () => {
    mocks.history.mockResolvedValue(history('dropped', 'cancelled'));
    view.rerender(await Page());
  };
  if (timing === 'before') await refresh();
  await act(async () => { resolve({ status: 'success', message: ENROLLMENT_CANCELLATION_SUCCESS_MESSAGE }); });
  if (timing === 'after') await refresh();
  expect((await view.findByRole('status')).textContent).toBe(ENROLLMENT_CANCELLATION_SUCCESS_MESSAGE);
  expect(view.getByText(/Enrollment dropped/)).toBeDefined();
  expect(view.queryByRole('button', { name: 'Batalkan pendaftaran' })).toBeNull();
  expect(view.queryByRole('dialog')).toBeNull();
  expect(mocks.cancel).toHaveBeenCalledOnce();
  // A later backend refresh also preserves feedback on the same keyed card.
  await refresh();
  expect(view.getByRole('status').textContent).toBe(ENROLLMENT_CANCELLATION_SUCCESS_MESSAGE);
});
