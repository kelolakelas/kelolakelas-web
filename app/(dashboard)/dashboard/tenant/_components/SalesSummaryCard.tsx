import { formatCurrency } from '@/lib/payment-status';
import { getTenantSalesSummary, type TenantSalesSummaryRead } from '../_queries/sales-summary';

const CARD_CLASS =
  'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/90 p-5 shadow-xs';

function formatDay(value: string) {
  // Billing's dates are UTC calendar days; format them in UTC so the label never shifts a day.
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function CardHeader({ period }: { period?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Penjualan Kelas
      </h2>
      <span className="text-xs text-gray-500 dark:text-gray-400">{period ?? '30 hari terakhir'}</span>
    </div>
  );
}

function Notice({ tone, title, description }: { tone: 'muted' | 'warning' | 'error'; title: string; description: string }) {
  const color =
    tone === 'error'
      ? 'text-red-700 dark:text-red-300'
      : tone === 'warning'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-gray-700 dark:text-gray-300';
  return (
    <div className="mt-3" role={tone === 'error' ? 'alert' : 'status'}>
      <p className={`text-sm font-semibold ${color}`}>{title}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
    </div>
  );
}

/** Pure view of every card state, so each can be rendered and tested without a request. */
export function SalesSummaryView({ read }: { read: TenantSalesSummaryRead }) {
  if (read.state === 'forbidden') {
    return (
      <section className={CARD_CLASS} aria-label="Penjualan Kelas" data-state="forbidden">
        <CardHeader />
        <Notice
          tone="warning"
          title="Anda tidak memiliki akses ke ringkasan penjualan."
          description="Ringkasan ini memerlukan izin billing:read. Hubungi pemilik tenant jika Anda membutuhkannya."
        />
      </section>
    );
  }

  if (read.state === 'error') {
    return (
      <section className={CARD_CLASS} aria-label="Penjualan Kelas" data-state="error">
        <CardHeader />
        <Notice
          tone="error"
          title="Ringkasan penjualan belum dapat dimuat."
          description="Muat ulang halaman beberapa saat lagi. Bagian dashboard lain tetap dapat digunakan."
        />
      </section>
    );
  }

  const period = `${formatDay(read.from)} – ${formatDay(read.to)} (UTC)`;
  if (read.totals.length === 0) {
    return (
      <section className={CARD_CLASS} aria-label="Penjualan Kelas" data-state="empty">
        <CardHeader period={period} />
        <Notice tone="muted" title="Belum ada penjualan." description="Tidak ada transaksi paid pada periode ini." />
      </section>
    );
  }

  return (
    <section className={CARD_CLASS} aria-label="Penjualan Kelas" data-state="ok">
      <CardHeader period={period} />
      <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {read.totals.map((total) => (
          <div key={total.currency} className="contents" data-currency={total.currency}>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Pendapatan kotor ({total.currency})</dt>
              <dd className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100" data-field="gross">
                {formatCurrency(total.gross_amount, total.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Pendapatan bersih ({total.currency})</dt>
              <dd className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100" data-field="net">
                {formatCurrency(total.net_amount, total.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Transaksi paid ({total.currency})</dt>
              <dd className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100" data-field="count">
                {total.transaction_count.toLocaleString('id-ID')}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export async function SalesSummaryCard() {
  return <SalesSummaryView read={await getTenantSalesSummary()} />;
}

export function SalesSummarySkeleton() {
  return (
    <section className={`${CARD_CLASS} animate-pulse`} aria-label="Penjualan Kelas" aria-busy="true" data-state="loading">
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-700" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-32 rounded-lg bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
      <span className="sr-only">Memuat ringkasan penjualan…</span>
    </section>
  );
}
