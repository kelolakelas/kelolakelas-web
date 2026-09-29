import { describe, expect, it } from 'vitest';
import { paymentChannelLabel, paymentInstructionsView, paymentIsSettling, paymentPresentation, resumePayment } from './payment-status';

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

  it('does not claim an active enrollment is inactive when one of its payments failed (KEL-44 renewal return)', () => {
    const failedRenewal = paymentPresentation({ ...enrollment, status: 'active' }, { id: 'transaction-2', enrollment_id: 'enrollment-1', status: 'expired' });
    expect(failedRenewal.label).toBe('Kedaluwarsa');
    expect(failedRenewal.detail).not.toContain('belum aktif');
    expect(paymentPresentation(enrollment, { id: 'transaction-1', enrollment_id: 'enrollment-1', status: 'failed' }).detail).toContain('belum aktif');
  });
});

describe('paymentIsSettling (KEL-44)', () => {
  const tx = (overrides: Record<string, unknown> = {}) => ({ id: 'transaction-1', enrollment_id: 'enrollment-1', status: 'pending', ...overrides });

  it.each([
    ['a payment the provider has not confirmed', enrollment, tx()],
    ['a transaction still creating its invoice', enrollment, tx({ status: 'creating' })],
    ['a paid payment whose enrollment is not active yet', enrollment, tx({ status: 'paid' })],
    ['a paid payment whose activation is being retried', enrollment, tx({ status: 'paid', reconciliation_status: 'reconciling' })],
  ])('keeps refreshing for %s', (_label, e, t) => {
    expect(paymentIsSettling(e, t)).toBe(true);
  });

  it.each([
    ['an active enrollment with a paid payment', { ...enrollment, status: 'active' }, tx({ status: 'paid', reconciliation_status: 'active' })],
    ['a failed payment', enrollment, tx({ status: 'failed' })],
    ['an expired payment', enrollment, tx({ status: 'expired' })],
    ['a cancelled payment', { ...enrollment, status: 'dropped' }, tx({ status: 'cancelled' })],
    ['a refunded payment', enrollment, tx({ status: 'refunded' })],
    ['a terminal activation failure', enrollment, tx({ status: 'paid', reconciliation_status: 'terminal_failed' })],
    ['a missing transaction', enrollment, undefined],
  ])('stops for %s', (_label, e, t) => {
    expect(paymentIsSettling(e, t)).toBe(false);
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

describe('paymentInstructionsView (KEL-127)', () => {
  const now = new Date('2026-09-26T04:00:00Z');

  it.each(['VA', 'BC'] as const)('uses the provider VA number for %s without a redirect', (payment_method) => {
    const view = paymentInstructionsView(transaction({ payment_method, va_number: '88001234567890' }), now);
    expect(view).toEqual({ kind: 'va', channelLabel: 'Virtual Account', vaNumber: '88001234567890', expiresLabel: expect.any(String) });
    expect(paymentChannelLabel(transaction({ payment_method }))).toBe('Virtual Account');
  });

  it.each(['SP', 'NQ'] as const)('uses the provider QR string for %s without synthesising it', (payment_method) => {
    const view = paymentInstructionsView(transaction({ payment_method, qr_string: '000201010212123QRIS', app_url: 'https://app.example.test/pay' }), now);
    expect(view).toEqual({ kind: 'qris', channelLabel: 'QRIS', qrString: '000201010212123QRIS', appUrl: 'https://app.example.test/pay', expiresLabel: expect.any(String) });
    expect(paymentChannelLabel(transaction({ payment_method }))).toBe('QRIS');
  });

  it.each(['paid', 'failed', 'expired', 'cancelled'] as const)('refuses stale instructions for a %s payment', (status) => {
    expect(paymentInstructionsView(transaction({ status, payment_method: 'VA', va_number: '88001234567890' }), now)).toBeNull();
  });

  it.each([undefined, '', PAST_EXPIRY, 'broken-date'])('refuses missing or expired invoice deadline %s', (invoice_expires_at) => {
    expect(paymentInstructionsView(transaction({ invoice_expires_at, payment_method: 'VA', va_number: '88001234567890' }), now)).toBeNull();
  });

  it('does not show a QR or VA instruction for card or mismatched methods', () => {
    expect(paymentInstructionsView(transaction({ payment_method: 'VC', va_number: '8800', qr_string: 'QR' }), now)).toBeNull();
    expect(paymentInstructionsView(transaction({ payment_method: 'VA', qr_string: 'QR' }), now)).toBeNull();
    expect(paymentInstructionsView(transaction({ payment_method: 'NQ', va_number: '8800' }), now)).toBeNull();
    expect(paymentChannelLabel(transaction({ payment_method: 'VC' }))).toBe('Kartu');
    expect(paymentChannelLabel(transaction({ payment_method: undefined }))).toBeNull();
  });

  it('refuses a script URL in app_url but keeps the QR payload', () => {
    expect(paymentInstructionsView(transaction({ payment_method: 'NQ', qr_string: 'QR', app_url: 'javascript:alert(1)' }), now)).toMatchObject({ kind: 'qris', qrString: 'QR', appUrl: null });
  });
});
