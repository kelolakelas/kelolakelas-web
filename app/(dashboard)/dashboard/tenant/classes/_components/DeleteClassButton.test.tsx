// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
const action = vi.hoisted(() => vi.fn());
vi.mock('../_actions/classActions', () => ({ deleteClass: action }));
import { DeleteClassButton } from './DeleteClassButton';
const id = '9b9ee145-f561-4acb-b231-6d22d076369c';
beforeEach(() => {
  action.mockReset();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(cleanup);
function open() {
  render(<DeleteClassButton classId={id} className="Algebra" />);
  const trigger = screen.getByRole('button', { name: 'Delete class Algebra' });
  fireEvent.click(trigger);
  return trigger;
}
it('names the class and cancels without DELETE, restoring focus', () => {
  const trigger = open();
  expect(
    screen.getByRole('dialog', { name: 'Delete “Algebra”?' }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(action).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it('submits once despite repeat events, disables cancellation while pending and closes only after success', async () => {
  let resolve!: (result: { success: boolean; message: string }) => void;
  action.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  open();
  const form = screen
    .getByRole('button', { name: 'Confirm Delete Class' })
    .closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(action).toHaveBeenCalledExactlyOnceWith(id);
  expect(
    (screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  const cancel = new Event('cancel', { cancelable: true });
  screen.getByRole('dialog').dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  await act(async () => resolve({ success: true, message: 'Class deleted.' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('Class deleted.');
  expect(
    screen.queryByRole('button', { name: 'Delete class Algebra' }),
  ).toBeNull();
});
it.each([
  'This class has active enrollments and cannot be deleted.',
  'You do not have permission.',
  'This class is no longer available.',
])(
  'keeps rejection visible and the class action available: %s',
  async (message) => {
    action.mockResolvedValue({ success: false, message });
    open();
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm Delete Class' }),
    );
    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(screen.getByRole('dialog')).toBeTruthy();
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.getByRole('button', { name: 'Delete class Algebra' }),
    ).toBeTruthy();
  },
);
it('shows an uncertain network outcome and permits explicit cancellation', async () => {
  action.mockRejectedValue(new Error('network'));
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete Class' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'could not be confirmed',
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
});
