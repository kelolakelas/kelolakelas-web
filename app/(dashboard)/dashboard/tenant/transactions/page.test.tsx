import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { transactions, parse, nav } = vi.hoisted(() => ({ transactions: vi.fn(), parse: vi.fn(), nav: vi.fn() }));
vi.mock('./_queries/transactions', () => ({ getTenantTransactions: transactions }));
vi.mock('../_queries/membership', () => ({ readTenantNav: nav }));
vi.mock('./_components/RefundTransactionButton', () => ({
  RefundTransactionButton: ({ transaction }: { transaction: { merchant_order_id: string } }) => (
    <div>Catat refund {transaction.merchant_order_id}</div>
  ),
}));
vi.mock('./_lib/transactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./_lib/transactions')>();
  return { ...actual, parseTransactionFilters: parse };
});
vi.mock('./_components/TransactionFilterBar', () => ({
  TransactionFilterBar: () => <div>Filter transaksi</div>,
}));

import TenantTransactionsPage, { TransactionsView } from './page';
import { defaultTransactionFilters } from './_lib/transactions';

const ROW = {
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
};

const PAGINATION = { page: 1, page_size: 20, total_items: 1, total_pages: 1 };

const FILTERS = {
  page: 1,
  status: 'paid',
  search: '',
  date_from: '2026-08-29',
  date_to: '2026-09-27',
};

function ok(rows: unknown[] = [ROW]) {
  return { data: { filters: FILTERS, rows, pagination: PAGINATION }, error: null };
}

function view(result: ReturnType<typeof ok> | { data: null; error: string; message?: string }, parsed = { filters: FILTERS, error: null }, canRefund = false) {
  return renderToStaticMarkup(
    <TransactionsView
      filters={FILTERS}
      defaults={defaultTransactionFilters(new Date('2026-09-27T10:00:00Z'))}
      parsed={parsed as never}
      result={result as never}
      canRefund={canRefund}
    />,
  );
}

async function page(params: Record<string, string> = {}, parsed: unknown = { filters: FILTERS, error: null }) {
  parse.mockReturnValue(parsed);
  return renderToStaticMarkup(
    await TenantTransactionsPage({ searchParams: Promise.resolve(params) }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  transactions.mockResolvedValue(ok());
  parse.mockReturnValue({ filters: FILTERS, error: null });
  nav.mockResolvedValue({ state: 'ok', membership: { permissions: ['billing:read', 'billing:refund'] } });
});

describe('tenant transactions page (KEL-148)', () => {
  it('renders the gross, fee, net, status, and paid date columns with a CSV link', async () => {
    const output = await page();

    expect(output).toContain('order-1');
    expect(output).toContain('paid');
    expect(output).toContain('Rp');
    expect(output).toContain('Unduh CSV');
    expect(output).toContain('/dashboard/tenant/transactions/export?');
    expect(output).toContain('date_by=paid_at');
  });

  it('shows the forbidden panel without the table or download to members without billing:read', () => {
    const output = view({ data: null, error: 'forbidden', message: 'tanpa izin' });

    expect(output).toContain('tidak memiliki akses');
    expect(output).not.toContain('order-1');
    expect(output).not.toContain('Unduh CSV');
  });

  it('shows the empty state for a range with no transactions', () => {
    const output = view(ok([]));

    expect(output).toContain('Tidak ada transaksi pada rentang ini');
    expect(output).not.toContain('Unduh CSV');
  });

  it('shows the invalid-filter notice and the outage panel distinctly', async () => {
    transactions.mockResolvedValue({ data: null, error: 'invalid_filter' });
    const invalid = await page({ status: 'all' }, { filters: null, error: 'invalid_filter' });
    expect(invalid).toContain('Filter tidak valid');

    const failed = view({ data: null, error: 'api', message: 'gagal' });
    expect(failed).toContain('belum dapat dimuat');
    expect(failed).not.toContain('tidak memiliki akses');
  });
});

describe('tenant transaction refund action (KEL-153)', () => {
  it('offers "Catat refund" only on the paid row to members with billing:refund', async () => {
    const output = await page();

    expect(output).toContain('Catat refund order-1');
  });

  it('hides the refund action entirely from members without billing:refund', async () => {
    nav.mockResolvedValue({ state: 'ok', membership: { permissions: ['billing:read'] } });
    const output = await page();

    expect(output).not.toContain('Catat refund');
    expect(output).toContain('order-1');
  });

  it('offers no refund action on refunded or non-paid rows', () => {
    const refunded = view(ok([{ ...ROW, id: 'tx-2', merchant_order_id: 'order-2', status: 'refunded' }]), undefined, true);
    expect(refunded).not.toContain('Catat refund');

    const pending = view(ok([{ ...ROW, id: 'tx-3', merchant_order_id: 'order-3', status: 'pending' }]), undefined, true);
    expect(pending).not.toContain('Catat refund');
  });
});
