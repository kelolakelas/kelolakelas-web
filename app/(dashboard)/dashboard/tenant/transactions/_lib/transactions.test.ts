import { describe, expect, it } from 'vitest';

import {
  defaultTransactionFilters,
  isValidTransactionDate,
  normalizeTenantTransaction,
  parseTransactionFilters,
  transactionExportHref,
  transactionExportQuery,
  transactionFeeTotal,
  transactionListQuery,
  transactionPageHref,
  type TransactionFilters,
} from './transactions';

/**
 * KEL-148 transaction filter parsing and query builders.
 *
 * The behaviours pinned here are the ones the acceptance criteria name: the
 * default view is `paid` over the last 30 UTC days (so it reconciles with the
 * sales summary), unparsable URL values produce `invalid_filter` instead of a
 * failed request, and the list and the CSV export always share the same
 * filter parameters (`date_by=paid_at`, strict `YYYY-MM-DD`, explicit
 * status).
 */

const NOW = new Date('2026-09-27T10:00:00Z');

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    merchant_order_id: 'order-1',
    status: 'paid',
    currency: 'IDR',
    gross_amount: 180000,
    platform_fee: 10000,
    payment_gateway_fee: 4000,
    net_amount: 166000,
    paid_at: '2026-09-20T03:00:00Z',
    created_at: '2026-09-19T10:00:00Z',
    ...overrides,
  };
}

describe('defaultTransactionFilters (KEL-148)', () => {
  it('defaults to paid over the last 30 UTC days ending today', () => {
    expect(defaultTransactionFilters(NOW)).toEqual({
      page: 1,
      status: 'paid',
      search: '',
      date_from: '2026-08-29',
      date_to: '2026-09-27',
    });
  });
});

describe('isValidTransactionDate (KEL-148)', () => {
  it.each([['2026-09-27'], ['2026-02-28'], ['2024-02-29']])('accepts the real day %s', (value) => {
    expect(isValidTransactionDate(value)).toBe(true);
  });

  it.each([['2026-02-30'], ['2026-13-01'], ['2026-00-10'], ['27-09-2026'], ['2026/09/27'], ['']])(
    'rejects %s',
    (value) => {
      expect(isValidTransactionDate(value)).toBe(false);
    },
  );
});

describe('parseTransactionFilters (KEL-148)', () => {
  it('resolves absent parameters to the paid last-30-days defaults', () => {
    expect(parseTransactionFilters({}, NOW)).toEqual({
      filters: {
        page: 1,
        status: 'paid',
        search: '',
        date_from: '2026-08-29',
        date_to: '2026-09-27',
      },
      error: null,
    });
  });

  it('reads an explicit status, search, page, and paid-date range', () => {
    expect(
      parseTransactionFilters(
        { status: 'pending', search: ' order-9 ', page: '2', date_from: '2026-09-01', date_to: '2026-09-10' },
        NOW,
      ),
    ).toEqual({
      filters: {
        page: 2,
        status: 'pending',
        search: 'order-9',
        date_from: '2026-09-01',
        date_to: '2026-09-10',
      },
      error: null,
    });
  });

  it.each([
    [{ page: '0' }],
    [{ page: 'abc' }],
    [{ status: 'all' }],
    [{ status: 'PAID' }],
    [{ date_from: '2026-02-30' }],
    [{ date_to: '27-09-2026' }],
    [{ date_from: '2026-09-10', date_to: '2026-09-01' }],
  ])('rejects %j as invalid_filter', (input) => {
    expect(parseTransactionFilters(input, NOW)).toEqual({ filters: null, error: 'invalid_filter' });
  });
});

describe('transaction list/export queries (KEL-148)', () => {
  const filters: TransactionFilters = {
    page: 2,
    status: 'paid',
    search: 'order-9',
    date_from: '2026-08-29',
    date_to: '2026-09-27',
  };

  it('sends only the vocabulary the billing List handler understands', () => {
    const params = new URLSearchParams(transactionListQuery(filters));

    expect(params.get('date_by')).toBe('paid_at');
    expect(params.get('status')).toBe('paid');
    expect(params.get('search')).toBe('order-9');
    expect(params.get('date_from')).toBe('2026-08-29');
    expect(params.get('date_to')).toBe('2026-09-27');
    expect(params.get('page')).toBe('2');
    expect(params.get('page_size')).toBe('20');
  });

  it('covers the same filter in the export without pagination', () => {
    const list = new URLSearchParams(transactionListQuery(filters));
    const exported = new URLSearchParams(transactionExportQuery(filters));

    for (const key of ['date_by', 'status', 'search', 'date_from', 'date_to']) {
      expect(exported.get(key)).toBe(list.get(key));
    }
    expect(exported.has('page')).toBe(false);
    expect(exported.has('page_size')).toBe(false);
  });

  it('preserves the active filters across pages and into the download link', () => {
    expect(transactionPageHref(filters)).toContain('status=paid');
    expect(transactionPageHref(filters)).toContain('page=2');

    const href = transactionExportHref(filters);
    expect(href.startsWith('/dashboard/tenant/transactions/export?')).toBe(true);
    expect(new URLSearchParams(href.split('?')[1]).get('date_by')).toBe('paid_at');
  });
});

describe('normalizeTenantTransaction (KEL-148)', () => {
  it('normalises a usable row and sums the fee columns', () => {
    const row = normalizeTenantTransaction(baseRow());

    expect(row).toMatchObject({ id: 'tx-1', merchant_order_id: 'order-1', currency: 'IDR' });
    expect(row && transactionFeeTotal(row)).toBe(14000);
  });

  it('keeps an unpaid row with a missing paid_at as an empty date', () => {
    const row = normalizeTenantTransaction(baseRow({ status: 'pending', paid_at: null }));

    expect(row?.paid_at).toBeNull();
  });

  it.each([
    [null],
    [[]],
    [{}],
    [baseRow({ id: '' })],
    [baseRow({ gross_amount: -1 })],
    [baseRow({ gross_amount: 1.5 })],
    [baseRow({ currency: 'ID' })],
    [baseRow({ currency: 'IDR1' })],
    [baseRow({ paid_at: 123 })],
  ])('drops the unusable row %j instead of failing the list', (raw) => {
    expect(normalizeTenantTransaction(raw)).toBeNull();
  });
});
