import { paymentPresentation, type PaymentPresentation } from '@/lib/payment-status';
import {
  enrollmentClassName,
  enrollmentStatusLabel,
  scheduleLabel,
  studentDisplayName,
  transactionAmountLabel,
} from '../_lib/schema';
import type { TenantEnrollmentRow } from '../_queries/queries';

/**
 * Payment state shown when billing refused the lookup with `403` (KEL-57).
 *
 * The member lacks `billing:read`, so the payment is unknown to them, not
 * missing: reading it as "Menunggu transaksi" would tell a teacher that a paid
 * enrollment has no invoice.
 */
const PAYMENT_FORBIDDEN: PaymentPresentation = {
  label: 'Tidak tersedia untuk role Anda',
  detail: 'Status pembayaran hanya dapat dilihat oleh role dengan izin billing:read.',
  tone: 'neutral',
};

/** Amount placeholder for a payment the member may not read. */
const AMOUNT_FORBIDDEN = 'Nominal tidak tersedia';

function rowPayment({ enrollment, transaction, paymentForbidden }: TenantEnrollmentRow) {
  if (paymentForbidden) {
    return { presentation: PAYMENT_FORBIDDEN, amount: AMOUNT_FORBIDDEN };
  }

  return {
    presentation: paymentPresentation(enrollment, transaction),
    amount: transactionAmountLabel(transaction),
  };
}

/**
 * Badge colours keyed by the tone vocabulary shared with `lib/payment-status`.
 *
 * The tenant surface uses the Tailwind gray/blue palette rather than the parent
 * surface's bespoke colours, so the tones are mapped here instead of importing
 * the parent page's class map.
 */
const TONES: Record<'neutral' | 'success' | 'warning' | 'danger', string> = {
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};

/** Badge colours for the raw enrollment lifecycle status. */
const ENROLLMENT_STATUS_TONES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  completed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  dropped: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};

function StatusBadge({ label, tone }: { label: string; tone: keyof typeof TONES }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}

function EnrollmentStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
        ENROLLMENT_STATUS_TONES[status] ??
        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      {enrollmentStatusLabel(status)}
    </span>
  );
}

/** Date an enrollment was created, formatted for an Indonesian reader. */
function joinedAtLabel(joinedAt?: string): string {
  if (typeof joinedAt !== 'string' || joinedAt === '') {
    return '—';
  }

  const parsed = new Date(joinedAt);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  }).format(parsed);
}

/**
 * Empty state shown when the filter matches nothing.
 *
 * The copy distinguishes the two reasons a tenant sees no rows: a filter that
 * excluded everything, and a tenant that has no enrollment at all. Both are
 * legitimate states of a working page, so neither is reported as an error.
 */
function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <section className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 sm:p-12 text-center shadow-xs">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
        {isFiltered ? 'Tidak ada enrollment pada status ini' : 'Belum ada enrollment'}
      </h3>
      <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {isFiltered
          ? 'Ubah atau atur ulang filter status untuk melihat enrollment lain.'
          : 'Enrollment student akan muncul di sini setelah pendaftaran kelas dibuat.'}
      </p>
    </section>
  );
}

/**
 * Enrollment rows for the tenant overview (KEL-33).
 *
 * Rendered as cards on small screens and as a table from `md` up, matching the
 * class and member tables on this dashboard. Every value shown comes from the
 * academic enrollment response or the billing transaction response; the payment
 * label, its explanation, and its tone are delegated to the shared
 * `paymentPresentation` so this screen and the parent surface can never
 * disagree about what a payment state means.
 *
 * The component is a Server Component: it receives already-fetched rows and
 * renders them, which keeps the payment badges free of any client-side
 * authorization decision.
 */
export function EnrollmentTable({
  rows,
  isFiltered,
}: {
  rows: TenantEnrollmentRow[];
  isFiltered: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState isFiltered={isFiltered} />;
  }

  return (
    <>
      {/* Mobile stacked cards */}
      <div className="block space-y-3 md:hidden">
        {rows.map((row) => {
          const { enrollment, schedule } = row;
          const { presentation: payment, amount } = rowPayment(row);

          return (
            <article
              key={enrollment.id}
              className="space-y-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {enrollmentClassName(enrollment)}
                  </h4>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    {studentDisplayName(enrollment.student)}
                  </p>
                </div>
                <EnrollmentStatusBadge status={enrollment.status} />
              </div>

              <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-xs">
                <div>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">Jadwal</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {scheduleLabel(schedule) ?? 'Belum ada jadwal'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                    Dibuat
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {joinedAtLabel(enrollment.joined_at)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                <StatusBadge label={payment.label} tone={payment.tone} />
                <p className="text-xs text-gray-500 dark:text-gray-400">{payment.detail}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {amount}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
          <caption className="sr-only">
            Daftar enrollment tenant beserta status enrollment dan status pembayaran
          </caption>
          <thead className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Student
              </th>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Kelas
              </th>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Jadwal
              </th>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Status enrollment
              </th>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Status pembayaran
              </th>
              <th scope="col" className="px-6 py-3.5 font-bold">
                Nominal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => {
              const { enrollment, transaction, schedule } = row;
              const { presentation: payment, amount } = rowPayment(row);

              return (
                <tr
                  key={enrollment.id}
                  className="transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                >
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                    {studentDisplayName(enrollment.student)}
                    <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                      Dibuat {joinedAtLabel(enrollment.joined_at)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {enrollmentClassName(enrollment)}
                    {enrollment.billing_cycle && (
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                        {enrollment.billing_cycle}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {scheduleLabel(schedule) ?? (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <EnrollmentStatusBadge status={enrollment.status} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge label={payment.label} tone={payment.tone} />
                    <span className="mt-1 block max-w-xs text-xs text-gray-500 dark:text-gray-400">
                      {payment.detail}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                    {amount}
                    {transaction && (
                      <span className="mt-0.5 block text-xs font-normal text-gray-500 dark:text-gray-400">
                        Transaksi {transaction.status}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
