import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** KEL-58: every state of the dashboard sales summary card. */

const query = vi.hoisted(() => ({ getTenantSalesSummary: vi.fn() }));

vi.mock('../_queries/sales-summary', () => ({ getTenantSalesSummary: query.getTenantSalesSummary }));

const { SalesSummaryCard, SalesSummarySkeleton, SalesSummaryView } = await import('./SalesSummaryCard');

const period = { from: '2026-08-29', to: '2026-09-27' };
const idr = { currency: 'IDR', transaction_count: 1234, gross_amount: 4500000, net_amount: 4050000 };

function text(markup: string) {
  return markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ');
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('SalesSummaryView', () => {
  it('shows gross, net, and paid count in rupiah for the UTC period', () => {
    const markup = renderToStaticMarkup(<SalesSummaryView read={{ state: 'ok', ...period, totals: [idr] }} />);
    const shown = text(markup);

    expect(markup).toContain('data-state="ok"');
    expect(shown).toContain('Penjualan Kelas');
    expect(shown).toContain('29 Agu 2026 – 27 Sep 2026 (UTC)');
    expect(shown).toMatch(/Rp\s?4\.500\.000/);
    expect(shown).toMatch(/Rp\s?4\.050\.000/);
    expect(shown).toContain('1.234');
  });

  it('keeps each currency in its own bucket instead of adding them', () => {
    const usd = { currency: 'USD', transaction_count: 2, gross_amount: 100, net_amount: 90 };
    const markup = renderToStaticMarkup(<SalesSummaryView read={{ state: 'ok', ...period, totals: [idr, usd] }} />);

    expect(markup).toContain('data-currency="IDR"');
    expect(markup).toContain('data-currency="USD"');
    expect(text(markup)).toMatch(/US\$\s?100/);
    expect(text(markup)).not.toMatch(/4\.500\.100/);
  });

  it('shows an empty period as no sales, not as an error', () => {
    const markup = renderToStaticMarkup(<SalesSummaryView read={{ state: 'ok', ...period, totals: [] }} />);

    expect(markup).toContain('data-state="empty"');
    expect(text(markup)).toContain('Belum ada penjualan.');
    expect(markup).not.toContain('role="alert"');
  });

  it('tells a member without billing:read that access is missing', () => {
    const markup = renderToStaticMarkup(<SalesSummaryView read={{ state: 'forbidden' }} />);

    expect(markup).toContain('data-state="forbidden"');
    expect(text(markup)).toContain('Anda tidak memiliki akses ke ringkasan penjualan.');
    expect(markup).not.toMatch(/Rp/);
  });

  it('shows a failed read as an alert without any figure', () => {
    const markup = renderToStaticMarkup(<SalesSummaryView read={{ state: 'error' }} />);

    expect(markup).toContain('data-state="error"');
    expect(markup).toContain('role="alert"');
    expect(text(markup)).toContain('Ringkasan penjualan belum dapat dimuat.');
    expect(markup).not.toMatch(/Rp/);
  });
});

describe('SalesSummaryCard', () => {
  it('renders the state read from billing', async () => {
    query.getTenantSalesSummary.mockResolvedValue({ state: 'ok', ...period, totals: [idr] });

    const markup = renderToStaticMarkup(await SalesSummaryCard());

    expect(query.getTenantSalesSummary).toHaveBeenCalledTimes(1);
    expect(text(markup)).toMatch(/Rp\s?4\.500\.000/);
  });
});

describe('SalesSummarySkeleton', () => {
  it('announces the loading state', () => {
    const markup = renderToStaticMarkup(<SalesSummarySkeleton />);

    expect(markup).toContain('aria-busy="true"');
    expect(text(markup)).toContain('Memuat ringkasan penjualan');
  });
});
