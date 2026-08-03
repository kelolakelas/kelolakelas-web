import type { Metadata } from 'next';
import { StudentForm } from '../../tenant/students/_components/StudentForm';
import { StudentList } from '../../tenant/students/_components/StudentList';
import { getStudents } from '../../tenant/students/_queries/queries';

export const metadata: Metadata = { title: 'Students - Parent Dashboard', alternates: { canonical: '/dashboard/parent/students' } };

export default async function ParentStudentsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const params = await searchParams;
  const result = await getStudents({ page: Math.max(1, Number(params.page) || 1), search: params.search });
  return <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6"><header className="border-b border-gray-200 pb-5"><h1 className="text-2xl font-bold text-gray-900">Anak</h1><p className="mt-1 text-sm text-gray-600">Data anak yang terhubung dengan akun orang tua ini.</p></header>{result.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.error}</div>}<div className="grid gap-6 lg:grid-cols-[1fr_2fr]"><StudentForm /><StudentList students={result.data} canMutate parentPath="/dashboard/parent/students" /></div></main>;
}