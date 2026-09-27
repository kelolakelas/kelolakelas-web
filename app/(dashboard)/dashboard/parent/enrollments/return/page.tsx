import type { Metadata } from 'next';
import Link from 'next/link';
import { formatCurrency, paymentIsSettling, paymentPresentation } from '@/lib/payment-status';
import { parseMerchantOrderId } from '@/lib/payment-return';
import { enrollmentScheduleLabel, SCHEDULE_UNAVAILABLE_LABEL } from '@/lib/enrollment-schedule';
import { getPaymentReturnStatus } from '../_queries/queries';
import { PaymentReturnRefresher } from './_components/PaymentReturnRefresher';

export const metadata: Metadata = { title: 'Status pembayaran - KelolaKelas', description: 'Status pembayaran enrollment setelah kembali dari provider pembayaran.' };

const tones = { neutral: 'bg-[#eef3f1] text-[#365047]', success: 'bg-[#e9f5df] text-[#356318]', warning: 'bg-[#fff3d6] text-[#815d00]', danger: 'bg-[#fde9e7] text-[#9b2922]' };

const HISTORY_PATH = '/dashboard/parent/enrollments';

type ReturnPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f] sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href={HISTORY_PATH} className="text-sm font-bold text-[#617c35] hover:underline">← Riwayat enrollment</Link>
        <header className="mt-7 border-b border-[#dfe3d7] pb-7">
          <p className="text-sm font-bold uppercase tracking-[.16em] text-[#617c35]">Pembayaran</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Status pembayaran</h1>
          <p className="mt-3 text-[#52615b]">Status di bawah selalu berasal dari server KelolaKelas setelah konfirmasi dari provider, bukan dari halaman pembayaran yang baru Anda tinggalkan.</p>
        </header>
        {children}
      </div>
    </main>
  );
}

function Problem({ title, message, retry }: { title: string; message: string; retry: boolean }) {
  return (
    <section className="mt-8 rounded-3xl border border-[#f2c6c3] bg-white p-6" role="alert">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-2 text-[#52615b]">{message}</p>
      <Link href={HISTORY_PATH} className="mt-5 inline-block rounded-xl bg-[#617c35] px-5 py-3 text-sm font-bold text-white hover:bg-[#54682d]">Lihat riwayat enrollment</Link>
      <PaymentReturnRefresher settling={retry} />
    </section>
  );
}

/**
 * Landing page for `DUITKU_RETURN_URL` (KEL-44).
 *
 * Only `merchantOrderId` is read from the query string, and only as a lookup key
 * for a transaction the backend scopes to the signed-in parent. `resultCode` and
 * `reference` are ignored: the provider redirect is unsigned and can be edited
 * by anyone, so the status shown is always the backend's. While that status can
 * still change on its own, `PaymentReturnRefresher` re-renders this page on a
 * bounded interval. Session and parent-only access are enforced by `proxy.ts`,
 * which sends a missing session to `/login` with this URL as `redirectTo`.
 */
export default async function PaymentReturnPage({ searchParams }: ReturnPageProps) {
  const params = await searchParams;
  const merchantOrderId = parseMerchantOrderId(params.merchantOrderId);
  if (!merchantOrderId) {
    return <Shell><Problem title="Tautan pembayaran tidak valid." message="Tautan ini tidak memuat nomor pesanan yang dapat diperiksa. Status semua pembayaran Anda tersedia di riwayat enrollment." retry={false} /></Shell>;
  }

  const result = await getPaymentReturnStatus(merchantOrderId);
  if (result.error) {
    const title = result.error === 'not_found' ? 'Pembayaran tidak ditemukan.' : result.error === 'forbidden' ? 'Akses ditolak.' : 'Status pembayaran belum dapat dimuat.';
    return <Shell><Problem title={title} message={result.message} retry={result.error === 'api'} /></Shell>;
  }

  const { enrollment, transaction } = result.data;
  const status = paymentPresentation(enrollment, transaction);
  const schedule = enrollmentScheduleLabel(enrollment);
  return (
    <Shell>
      <section className="mt-8 rounded-3xl border border-[#dfe3d7] bg-white p-6" aria-live="polite">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-black">{enrollment.class?.name || 'Kelas'}</h2>
            <p className="mt-1 text-sm text-[#52615b]">{enrollment.student?.first_name || 'Student'} · Enrollment {enrollment.status}</p>
            {schedule && <p className="mt-1 text-sm font-semibold text-[#365047]">{schedule === SCHEDULE_UNAVAILABLE_LABEL ? schedule : `Jadwal: ${schedule}`}</p>}
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${tones[status.tone]}`}>{status.label}</span>
        </div>
        <p className="mt-4 text-[#52615b]">{status.detail}</p>
        <dl className="mt-5 grid gap-3 border-t border-[#edf0e9] pt-4 text-sm sm:grid-cols-2">
          <div><dt className="text-[#65726c]">Status transaksi</dt><dd className="font-semibold">{transaction.status}</dd></div>
          <div><dt className="text-[#65726c]">Nominal</dt><dd className="font-semibold">{formatCurrency(transaction.gross_amount, transaction.currency)}</dd></div>
        </dl>
        <PaymentReturnRefresher settling={paymentIsSettling(enrollment, transaction)} />
      </section>
      <Link href={HISTORY_PATH} className="mt-6 inline-block rounded-xl bg-[#617c35] px-5 py-3 text-sm font-bold text-white hover:bg-[#54682d]">Lihat riwayat enrollment</Link>
    </Shell>
  );
}
