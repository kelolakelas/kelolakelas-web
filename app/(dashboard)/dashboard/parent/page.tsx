import { logoutAction } from '@/app/_actions/logout';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTransactions } from '../tenant/billing/_queries/queries';
import { getEnrollments } from '../tenant/enrollments/_queries/queries';
import { getStudents } from '../tenant/students/_queries/queries';

export const metadata: Metadata = {
  title: 'Dashboard Orang Tua - Tutorin',
  description: 'Ringkasan aktivitas belajar dan kelas anak.',
  alternates: { canonical: '/dashboard/parent' },
};

export default async function ParentDashboardPage() {
  const [students, enrollments, transactions] = await Promise.all([
    getStudents(),
    getEnrollments({ page: 1 }),
    getTransactions({ page: 1 }),
  ]);
  const activeEnrollments = enrollments.data.filter((item) => item.status === 'active');
  const pendingPayments = transactions.data.filter((item) => ['pending', 'failed'].includes(item.status));

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard orang tua</h1>
            <p className="mt-1 text-sm text-gray-600">Data anak, enrollment, dan transaksi dari akun Anda.</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold">Keluar</button>
          </form>
        </header>
        {[students, enrollments, transactions].some((result) => result.error) && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {students.error || enrollments.error || transactions.error}
          </div>
        )}
        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Anak</p>
            <p className="mt-2 text-3xl font-bold">{students.data.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Enrollment aktif</p>
            <p className="mt-2 text-3xl font-bold">{activeEnrollments.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Pembayaran perlu perhatian</p>
            <p className="mt-2 text-3xl font-bold">{pendingPayments.length}</p>
          </div>
        </section>
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Daftar anak</h2>
              <Link href="/dashboard/parent/students" className="text-sm font-semibold text-blue-700">Kelola</Link>
            </div>
            {students.data.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Belum ada data anak.</p>
            ) : (
              <ul className="mt-4 divide-y divide-gray-100">
                {students.data.map((student) => (
                  <li key={student.id} className="flex justify-between py-3 text-sm">
                    <span>{student.full_name}</span>
                    <Link href={`/dashboard/parent/students/${student.id}`} className="font-semibold text-blue-700">Detail</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="font-semibold">Enrollment aktif</h2>
            {activeEnrollments.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Belum ada enrollment aktif.</p>
            ) : (
              <ul className="mt-4 divide-y divide-gray-100">
                {activeEnrollments.map((item) => (
                  <li key={item.id} className="py-3 text-sm">{item.student?.full_name || item.student_id} · {item.class?.name || item.class_id}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">Session, attendance, dan reports</h2>
          <p className="mt-2 text-sm text-amber-900">Endpoint backend saat ini tenant-scoped untuk session, attendance, dan reports, sehingga data parent read-only belum tersedia tanpa kontrak parent-scoped.</p>
        </section>
        <nav className="flex flex-wrap gap-3">
          <Link href="/dashboard/parent/students" className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white">Tambah anak</Link>
          <Link href="/dashboard/parent/transactions" className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-4 text-sm font-semibold">Lihat transaksi</Link>
        </nav>
      </div>
    </main>
  );
}