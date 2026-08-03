import type { Metadata } from 'next';
import { StudentList } from './_components/StudentList';
import { getStudents } from './_queries/queries';

export const metadata: Metadata = { title: 'Students - Tenant Dashboard', alternates: { canonical: '/dashboard/tenant/students' } };

export default async function TenantStudentsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const params = await searchParams;
  const result = await getStudents({ page: Math.max(1, Number(params.page) || 1), search: params.search });
  return <main className="mx-auto w-full max-w-5xl space-y-6"><header className="border-b border-gray-200 pb-5"><h1 className="text-2xl font-bold text-gray-900">Students</h1><p className="mt-1 text-sm text-gray-600">Directory student yang tersedia untuk tenant ini.</p></header><form method="get" className="flex gap-2"><input name="search" defaultValue={params.search} placeholder="Cari student" className="min-h-11 flex-1 rounded-lg border border-gray-300 px-3" /><button className="min-h-11 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white">Cari</button></form>{result.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.error}</div>}<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Create student dari tenant membutuhkan parent selector, tetapi backend belum menyediakan endpoint daftar parent. Aksi create tenant unavailable untuk menjaga kontrak.</div><StudentList students={result.data} canMutate={false} parentPath="/dashboard/tenant/students" /></main>;
}