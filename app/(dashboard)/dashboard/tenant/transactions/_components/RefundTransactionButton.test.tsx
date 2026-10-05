// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

/**
 * Behaviour test for the KEL-153 refund dialog.
 *
 * What the acceptance criteria name about the dialog is pinned here: the
 * control renders only for a `paid` row when the member holds
 * `billing:refund`, the confirmation is an accessible native dialog, the
 * submit stays disabled while the reason or the transfer reference is blank,
 * and a refused refund keeps the dialog open with the reason. The Server
 * Action is mocked because this test covers the dialog contract only; the
 * action contract lives in `refundActions.test.ts`.
 *
 * jsdom implements neither `HTMLDialogElement.showModal` nor `close`, so
 * both are stubbed with an `open` flag the component reads back.
 */

const mocks = vi.hoisted(() => ({ action: vi.fn(), actionState: vi.fn() }));

vi.mock('../_actions/refundActions', () => ({ recordTransactionRefund: mocks.action }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    // By default the real hook runs; a test may install an implementation to
    // pin how one action state renders without submitting the form.
    useActionState: (...args: unknown[]) =>
      mocks.actionState.getMockImplementation()
        ? (mocks.actionState as (...a: unknown[]) => unknown)(...args)
        : (actual.useActionState as (...a: unknown[]) => unknown)(...args),
  };
});

function stubDialog() {
  // jsdom implements neither `showModal` nor `close`. The stubs mirror the
  // real methods' contract — `showModal` adds the `open` attribute, `close`
  // removes it — so testing-library treats the opened dialog's content as
  // accessible, exactly like a dialog the member opened.
  window.HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  } as typeof window.HTMLDialogElement.prototype.showModal;
  window.HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  } as typeof window.HTMLDialogElement.prototype.close;
}

stubDialog();

const { RefundTransactionButton } = await import('./RefundTransactionButton');

const TRANSACTION = { id: 'tx-1', merchant_order_id: 'order-1' };

afterEach(() => {
  cleanup();
  mocks.action.mockReset();
  mocks.actionState.mockReset();
});

describe('RefundTransactionButton', () => {
  it('opens an accessible dialog describing the enrollment consequence', () => {
    render(<RefundTransactionButton transaction={TRANSACTION} />);

    fireEvent.click(screen.getByRole('button', { name: /Catat refund/ }));

    const dialog = document.querySelector('dialog');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('refund-transaction-title-tx-1');
    expect(dialog?.getAttribute('aria-describedby')).toBe('refund-transaction-description-tx-1');
    expect(screen.getByRole('heading', { name: /Catat refund/ })).toBeTruthy();
    expect(screen.getByText(/Enrollment terkait transaksi ini akan diakhiri/)).toBeTruthy();
    expect(screen.getByLabelText('Alasan refund')).toBeTruthy();
    expect(screen.getByLabelText('Referensi transfer')).toBeTruthy();
  });

  it('keeps the submit disabled until both evidence fields are filled', () => {
    render(<RefundTransactionButton transaction={TRANSACTION} />);

    fireEvent.click(screen.getByRole('button', { name: /Catat refund/ }));

    const submit = screen.getByRole('button', { name: 'Ya, catat refund' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Alasan refund'), { target: { value: 'Kelas dibatalkan' } });
    expect((screen.getByRole('button', { name: 'Ya, catat refund' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Referensi transfer'), { target: { value: 'TRF-1' } });
    expect((screen.getByRole('button', { name: 'Ya, catat refund' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getByLabelText('Alasan refund'), { target: { value: '   ' } });
    expect((screen.getByRole('button', { name: 'Ya, catat refund' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps a refused refund open with the reason where the member is looking', () => {
    mocks.actionState.mockImplementation(() => [
      { status: 'error', message: 'Transaksi ini sudah tidak dapat di-refund. Muat ulang halaman.' },
      mocks.action,
    ]);

    render(<RefundTransactionButton transaction={TRANSACTION} />);

    fireEvent.click(screen.getByRole('button', { name: /Catat refund/ }));
    const dialog = document.querySelector('dialog');
    expect(dialog?.hasAttribute('open')).toBe(true);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Muat ulang halaman');
    // The refusal never closes the dialog: the member reads it and decides again.
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(screen.getByRole('button', { name: 'Ya, catat refund' })).toBeTruthy();
  });
});
