import type { Metadata } from 'next';
import Link from 'next/link';
import { StudentForm } from './_components/StudentForm';
import { StudentList } from './_components/StudentList';
import { getStudents } from './_queries/queries';

export const metadata: Metadata = { title: 'Students - Tenant Dashboard', alternates: { canonical: '/dashboard/tenant/students' } };

export default async function TenantStudentsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; create?: string }> }) {
  const params = await searchParams;
  const result = await getStudents({ page: Math.max(1, Number(params.page) || 1), search: params.search });
  const isCreating = params.create === '1';
  return <main className="mx-auto w-full max-w-5xl space-y-6"><header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-blue-700">Direktori akademik</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Students</h1><p className="mt-2 text-sm text-slate-600">Kelola data student yang terhubung dengan tenant ini.</p></div>{!isCreating && <Link href="/dashboard/tenant/students?create=1" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Tambah student</Link>}</header>{isCreating ? <section className="space-y-4"><div><Link href="/dashboard/tenant/students" className="text-sm font-semibold text-blue-700">Kembali ke direktori</Link><h2 className="mt-3 text-xl font-bold text-slate-950">Tambah student</h2><p className="mt-1 text-sm text-slate-600">Isi data student dan parent yang menaunginya.</p></div><StudentForm /></section> : <><form method="get" className="flex gap-2"><input name="search" defaultValue={params.search} placeholder="Cari nama student" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3" /><button className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800">Cari</button></form>{result.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.error}</div>}<StudentList students={result.data} canMutate parentPath="/dashboard/tenant/students" /></>}</main>;
}