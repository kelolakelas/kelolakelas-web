import type { Metadata } from 'next';
import Link from 'next/link';
import { formatJakartaDate } from '../../_lib/progress';
import { getStudentReportDetail } from '../../_queries/queries';
import { ReportChatButton } from './_components/ReportChatButton';

export const metadata: Metadata = {
  title: 'Detail Laporan Anak - KelolaKelas',
  description: 'Detail laporan perkembangan anak.',
};

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function backHref(searchParams: Record<string, string | string[] | undefined>): string {
  const raw = searchParams.student;
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return value ? `/dashboard/parent/progress?student=${encodeURIComponent(value)}` : '/dashboard/parent/progress';
}

/**
 * Report detail for one child (KEL-141, read-only).
 *
 * The report is fetched parent-scoped: another parent's id answers 404
 * upstream and renders the not-found state, never a forbidden leak. Chat
 * uses the existing inbox entry point (`/dashboard/parent/chat`), which
 * starts a `report` conversation get-or-create from the report row.
 */
export default async function ParentReportDetailPage({ params, searchParams }: Props) {
  const { reportId } = await params;
  const query = await searchParams;
  const result = await getStudentReportDetail(reportId);

  if (result.error) {
    const notFound = result.error === 'not_found';
    return (
      <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f] sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link href={backHref(query)} className="text-sm font-bold text-[#617c35] hover:underline">
            ← Kembali ke progres
          </Link>
          <section className="mt-6 rounded-3xl border border-[#f2c6c3] bg-white p-8" role={notFound ? undefined : 'alert'}>
            <p className="text-sm font-bold uppercase tracking-[.14em] text-[#b42318]">
              {result.error === 'forbidden' ? 'Akses ditolak' : notFound ? 'Laporan tidak ditemukan' : 'Laporan tidak tersedia'}
            </p>
            <h1 className="mt-2 text-3xl font-black">
              {notFound ? 'Laporan tidak ditemukan pada akun Anda.' : 'Detail laporan belum dapat dimuat.'}
            </h1>
            <p className="mt-3 text-[#52615b]">{result.message}</p>
          </section>
        </div>
      </main>
    );
  }

  const report = result.data;

  return (
    <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href={backHref(query)} className="text-sm font-bold text-[#617c35] hover:underline">
          ← Kembali ke progres
        </Link>
        <article className="mt-6 rounded-3xl border border-[#dfe3d7] bg-white p-8">
          <p className="text-sm font-bold uppercase tracking-[.16em] text-[#617c35]">Laporan anak</p>
          <h1 className="mt-2 text-3xl font-black">{report.title || 'Laporan'}</h1>
          <p className="mt-2 text-sm text-[#52615b]">{formatJakartaDate(report.created_at ?? null)}</p>
          {typeof report.score === 'number' && (
            <p className="mt-3 inline-block rounded-full bg-[#eef3f1] px-3 py-1 text-sm font-bold text-[#365047]">
              Nilai: {report.score}
            </p>
          )}
          <section className="mt-5 border-t border-[#edf0e9] pt-5" aria-label="Catatan evaluasi">
            <h2 className="text-lg font-black">Catatan evaluasi</h2>
            <p className="mt-2 whitespace-pre-line text-[#2b3a35]">
              {report.evaluation_notes || 'Belum ada catatan evaluasi untuk laporan ini.'}
            </p>
          </section>
          <div className="mt-6 border-t border-[#edf0e9] pt-5">
            <ReportChatButton reportId={report.id} />
            <p className="mt-2 text-sm text-[#65726c]">
              Chat dibuka di inbox pada percakapan laporan ini.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
