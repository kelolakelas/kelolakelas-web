// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installDialogDOM } from '@/test-support/dialog';
import { ModalDialog } from './ModalDialog';
beforeEach(installDialogDOM);
afterEach(cleanup);

it('keeps the open dialog outside a hidden responsive ancestor and locks background scroll', () => {
  const { container, unmount } = render(<div hidden><ModalDialog label="Edit class" onClose={() => {}}><input defaultValue="Unsaved draft" /></ModalDialog></div>);
  const dialog = screen.getByRole('dialog', { name: 'Edit class' });
  expect(container.contains(dialog)).toBe(false);
  expect(document.body.contains(dialog)).toBe(true);
  expect((dialog as HTMLDialogElement).open).toBe(true);
  expect(document.body.style.overflow).toBe('hidden');
  expect((dialog.querySelector('input') as HTMLInputElement).value).toBe('Unsaved draft');
  unmount();
  expect(document.body.style.overflow).toBe('');
  expect(document.body.contains(dialog)).toBe(false);
});

it('uses native cancel and only dismisses outside content when explicitly requested', () => {
  const close = vi.fn();
  render(<ModalDialog label="Navigation" onClose={close} dismissOnBackdrop><button>Inside</button></ModalDialog>);
  const dialog = screen.getByRole('dialog');
  fireEvent.click(screen.getByRole('button'));
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(dialog);
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
  expect(close).toHaveBeenCalledTimes(2);
});
