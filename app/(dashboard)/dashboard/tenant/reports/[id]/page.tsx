import type { Metadata } from 'next';
import Link from 'next/link';
import { getEnrollments } from '../../enrollments/_queries/queries';
import { ReportForm } from '../_components/ReportForm';
import { getReport } from '../_queries/queries';

export const metadata: Metadata = { title: 'Report Detail - Tenant Dashboard', alternates: { canonical: '/dashboard/tenant/reports' } };

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [report, enrollments] = await Promise.all([getReport(id), getEnrollments({ page: 1 })]);
  return <main className="mx-auto w-full max-w-3xl space-y-6"><Link href="/dashboard/tenant/reports" className="text-sm font-semibold text-blue-700">Kembali ke reports</Link>{report.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{report.error}</div>}{report.data ? <ReportForm enrollments={enrollments.data} report={report.data} /> : <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Report tidak ditemukan.</div>}</main>;
}