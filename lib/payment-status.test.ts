import { describe, expect, it } from 'vitest';
import { paymentPresentation } from './payment-status';

const enrollment = { id: 'enrollment-1', status: 'pending' };

describe('paymentPresentation', () => {
  it('keeps reconciliation separate from a paid active enrollment', () => {
    expect(paymentPresentation(enrollment, { id: 'transaction-1', enrollment_id: 'enrollment-1', status: 'paid', reconciliation_status: 'reconciling' }).label).toContain('aktivasi');
    expect(paymentPresentation({ ...enrollment, status: 'active' }, { id: 'transaction-1', enrollment_id: 'enrollment-1', status: 'paid', reconciliation_status: 'active' }).label).toBe('Aktif');
  });

  it('explains terminal and failed payment states', () => {
    expect(paymentPresentation(enrollment, { id: 'transaction-1', enrollment_id: 'enrollment-1', status: 'paid', reconciliation_status: 'terminal_failed' }).tone).toBe('danger');
    expect(paymentPresentation(enrollment, { id: 'transaction-1', enrollment_id: 'enrollment-1', status: 'expired' }).label).toBe('Kedaluwarsa');
  });
});
