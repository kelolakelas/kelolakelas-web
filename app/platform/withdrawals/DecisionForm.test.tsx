// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { useAction, refresh } = vi.hoisted(() => ({ useAction: vi.fn(), refresh: vi.fn() }));
vi.mock('react', async importOriginal => ({ ...(await importOriginal<typeof import('react')>()), useActionState: useAction }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('./actions', () => ({ decideWithdrawal: vi.fn() }));
import { DecisionForm } from './DecisionForm';

beforeEach(() => {
  useAction.mockReturnValue([{ status: 0, message: '' }, vi.fn()]);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('withdrawal decision form', () => {
  it('requires a reason only for rejection and a transfer reference for paid', () => {
    render(<DecisionForm id="withdrawal" destination="BCA 12345" />);
    fireEvent.click(screen.getByRole('button', { name: 'Review withdrawal' }));
    const decision = screen.getByRole('combobox', { name: 'Decision' });
    fireEvent.change(decision, { target: { value: 'reject' } });
    const reason = screen.getByRole('textbox', { name: 'Rejection reason' }) as HTMLTextAreaElement;
    expect(reason.required).toBe(true);
    expect(reason.maxLength).toBe(2000);
    expect(reason.checkValidity()).toBe(false);
    fireEvent.change(decision, { target: { value: 'paid' } });
    expect(screen.queryByRole('textbox', { name: 'Rejection reason' })).toBeNull();
    const reference = screen.getByRole('textbox', { name: 'Transfer reference' }) as HTMLInputElement;
    expect(reference.required).toBe(true);
    expect(reference.maxLength).toBe(255);
  });
  it('keeps a competing decision conflict visible to the admin', () => {
    useAction.mockReturnValue([{ status: 409, message: 'Withdrawal already processed or changed by another admin. Refresh the queue before deciding again.' }, vi.fn()]);
    render(<DecisionForm id="withdrawal" destination="BCA 12345" />);
    expect(screen.getAllByRole('status').some(node => node.textContent?.includes('another admin'))).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });
  it('refreshes the list on success and preserves session expiry feedback', () => {
    useAction.mockReturnValue([{ status: 200, message: 'Payment recorded.' }, vi.fn()]);
    const { rerender } = render(<DecisionForm id="withdrawal" destination="BCA 12345" />);
    expect(refresh).toHaveBeenCalled();
    useAction.mockReturnValue([{ status: 401, message: 'Session expired. Sign in again.' }, vi.fn()]);
    rerender(<DecisionForm id="withdrawal" destination="BCA 12345" />);
    expect(screen.getAllByRole('status').some(node => node.textContent?.includes('Session expired'))).toBe(true);
  });
});
