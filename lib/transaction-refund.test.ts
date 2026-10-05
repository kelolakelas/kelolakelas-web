import { describe, expect, it } from 'vitest';

import {
  canRefundTransaction,
  EMPTY_REFUND_REASON_MESSAGE,
  EMPTY_REFUND_REFERENCE_MESSAGE,
  EMPTY_TRANSACTION_REFUND_STATE,
  hasRefundPermission,
  INVALID_TRANSACTION_ID_MESSAGE,
  isRefundableTransactionId,
  REFUNDABLE_TRANSACTION_STATUS,
  TRANSACTION_REFUND_PERMISSION,
  transactionRefundErrorMessage,
  transactionRefundRequestPath,
} from './transaction-refund';

/**
 * Unit test for the KEL-153 refund decision logic.
 *
 * The Server Action module may only export async functions, so the gating,
 * identifier, and error-mapping rules live here and are pinned without a
 * gateway or a request context. The action's own request contract (exact
 * method, path, and body) is pinned in
 * `app/(dashboard)/dashboard/tenant/transactions/_actions/refundActions.test.ts`.
 */
describe('canRefundTransaction', () => {
  it('offers the action only for paid rows', () => {
    expect(canRefundTransaction(REFUNDABLE_TRANSACTION_STATUS)).toBe(true);
    expect(canRefundTransaction('refunded')).toBe(false);
    expect(canRefundTransaction('pending')).toBe(false);
    expect(canRefundTransaction('failed')).toBe(false);
    expect(canRefundTransaction('expired')).toBe(false);
    expect(canRefundTransaction('cancelled')).toBe(false);
    expect(canRefundTransaction('creating')).toBe(false);
  });
});

describe('hasRefundPermission', () => {
  it('requires the billing:refund permission', () => {
    expect(hasRefundPermission([TRANSACTION_REFUND_PERMISSION])).toBe(true);
    expect(hasRefundPermission(['billing:read', TRANSACTION_REFUND_PERMISSION])).toBe(true);
    expect(hasRefundPermission(['billing:read'])).toBe(false);
    expect(hasRefundPermission([])).toBe(false);
  });
});

describe('isRefundableTransactionId', () => {
  it('accepts a UUID and rejects anything else before any request', () => {
    expect(isRefundableTransactionId('3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11')).toBe(true);
    expect(isRefundableTransactionId('')).toBe(false);
    expect(isRefundableTransactionId('not-a-uuid')).toBe(false);
    expect(isRefundableTransactionId('tx-1')).toBe(false);
  });
});

describe('transactionRefundRequestPath', () => {
  it('targets the billing refund endpoint for the transaction', () => {
    expect(transactionRefundRequestPath('tx-1')).toBe('/api/v1/billing/transactions/tx-1/refund');
  });
});

describe('transactionRefundErrorMessage', () => {
  it('explains the already-refunded conflict with a reload next step', () => {
    expect(transactionRefundErrorMessage(409)).toContain('Muat ulang');
    expect(transactionRefundErrorMessage(409)).not.toContain('error');
  });

  it('separates session, permission, and missing rows', () => {
    expect(transactionRefundErrorMessage(401)).toContain('masuk kembali');
    expect(transactionRefundErrorMessage(403)).toContain('billing:refund');
    expect(transactionRefundErrorMessage(404)).toContain('tidak ditemukan');
  });

  it('separates a bad request from an unavailable service', () => {
    expect(transactionRefundErrorMessage(400)).toContain('tidak valid');
    expect(transactionRefundErrorMessage(503)).toContain('tidak tersedia');
  });

  it('never passes raw server error text through', () => {
    expect(transactionRefundErrorMessage(500, 'pq: duplicate key value')).not.toContain('pq:');
    expect(transactionRefundErrorMessage(500, 'pq: duplicate key value')).toBeTruthy();
  });
});

describe('transaction refund messages', () => {
  it('declares the empty-field messages the form and action share', () => {
    expect(EMPTY_REFUND_REASON_MESSAGE).toBeTruthy();
    expect(EMPTY_REFUND_REFERENCE_MESSAGE).toBeTruthy();
    expect(INVALID_TRANSACTION_ID_MESSAGE).toBeTruthy();
    expect(EMPTY_TRANSACTION_REFUND_STATE).toEqual({ status: 'idle', message: '' });
  });
});
