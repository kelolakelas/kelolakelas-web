import type { Metadata } from 'next';
import Link from 'next/link';
import { getParentStudents } from '../_queries/queries';
import { StudentForm } from './_components/StudentForm';
import { StudentList } from './_components/StudentList';
import { StudentPagination } from './_components/StudentPagination';

export const metadata: Metadata = { title: 'Students - Parent Dashboard', alternates: { canonical: '/dashboard/parent/students' } };

export default async function ParentStudentsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; create?: string }> }) {
  const params = await searchParams;
  const result = await getParentStudents({ page: Math.max(1, Number(params.page) || 1), search: params.search });
  const isCreating = params.create === '1';
  return <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6"><header className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold text-gray-900">Anak</h1><p className="mt-1 text-sm text-gray-600">Data anak yang terhubung dengan akun orang tua ini.</p></div>{!isCreating && <Link href="/dashboard/parent/students?create=1" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Tambah anak</Link>}</header>{isCreating ? <section className="space-y-4"><div><Link href="/dashboard/parent/students" className="text-sm font-semibold text-blue-700">Kembali ke daftar anak</Link><h2 className="mt-3 text-xl font-bold text-gray-900">Tambah anak</h2></div><StudentForm /></section> : <><form method="get" className="flex gap-2"><input name="search" defaultValue={params.search} placeholder="Cari nama anak" className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3" /><button className="min-h-11 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white">Cari</button></form>{result.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.error}</div>}<StudentList students={result.data} parentPath="/dashboard/parent/students" /><StudentPagination pagination={result.pagination} search={params.search} /></>}</main>;
}