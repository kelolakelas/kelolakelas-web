import { describe, expect, it } from 'vitest';
import { paymentPresentation, resumePayment } from './payment-status';

const enrollment = { id: 'enrollment-1', status: 'pending' };

/** ISO instant comfortably in the future, independent of when the test runs. */
const FUTURE_EXPIRY = '2100-01-01T00:00:00Z';
const PAST_EXPIRY = '2000-01-01T00:00:00Z';

function transaction(overrides: Partial<Parameters<typeof resumePayment>[0]> = {}): NonNullable<Parameters<typeof resumePayment>[0]> {
  return { id: 'transaction-1', enrollment_id: 'enrollment-1', status: 'pending', checkout_session_url: 'https://checkout.example.com/pay/abc', invoice_expires_at: FUTURE_EXPIRY, ...overrides };
}

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

describe('resumePayment (KEL-53)', () => {
  const fixedNow = new Date('2026-09-26T04:00:00Z');

  it('offers the checkout link for a pending transaction whose invoice is still valid', () => {
    const payment = resumePayment(transaction(), fixedNow);
    expect(payment).not.toBeNull();
    expect(payment?.url).toBe('https://checkout.example.com/pay/abc');
    expect(payment?.expiresLabel).toBeTruthy();
  });

  it('accepts an http checkout URL', () => {
    expect(resumePayment(transaction({ checkout_session_url: 'http://checkout.example.com/pay/abc' }), fixedNow)?.url).toBe('http://checkout.example.com/pay/abc');
  });

  it('keeps the URL as-is except for URL normalisation', () => {
    const url = 'https://checkout.example.com/pay/abc?x=1';
    expect(resumePayment(transaction({ checkout_session_url: url }), fixedNow)?.url).toBe(url);
  });

  it.each(['paid', 'failed', 'expired', 'cancelled'] as const)('never offers the link for a %s transaction', (status) => {
    expect(resumePayment(transaction({ status }), fixedNow)).toBeNull();
  });

  it('does not offer the link once the invoice has expired', () => {
    expect(resumePayment(transaction({ invoice_expires_at: PAST_EXPIRY }), fixedNow)).toBeNull();
  });

  it('treats the exact expiry instant as already expired', () => {
    expect(resumePayment(transaction({ invoice_expires_at: fixedNow.toISOString() }), fixedNow)).toBeNull();
  });

  it('does not offer the link for an old transaction without invoice_expires_at', () => {
    expect(resumePayment(transaction({ invoice_expires_at: undefined }), fixedNow)).toBeNull();
  });

  it('does not offer the link when the checkout URL is missing or blank', () => {
    expect(resumePayment(transaction({ checkout_session_url: undefined }), fixedNow)).toBeNull();
    expect(resumePayment(transaction({ checkout_session_url: '   ' }), fixedNow)).toBeNull();
  });

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://checkout.example.com/pay', 'checkout.example.com/pay'])('refuses the non-http(s) URL %s', (url) => {
    expect(resumePayment(transaction({ checkout_session_url: url }), fixedNow)).toBeNull();
  });

  it('refuses a malformed invoice_expires_at instead of showing a link with a broken deadline', () => {
    expect(resumePayment(transaction({ invoice_expires_at: 'not-a-date' }), fixedNow)).toBeNull();
  });

  it('judges expiry against the server time passed in, not the current clock', () => {
    const issuedNow = new Date(Date.now() + 60_000);
    const expiry = new Date(issuedNow.getTime() + 60_000).toISOString();
    expect(resumePayment(transaction({ invoice_expires_at: expiry }), issuedNow)).not.toBeNull();
    expect(resumePayment(transaction({ invoice_expires_at: expiry }), new Date(issuedNow.getTime() + 120_000))).toBeNull();
  });

  it('returns null when there is no transaction at all', () => {
    expect(resumePayment(undefined, fixedNow)).toBeNull();
  });
});
