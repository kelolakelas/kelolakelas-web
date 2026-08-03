import type { Metadata } from 'next';
import Link from 'next/link';
import { StudentForm } from '../../../tenant/students/_components/StudentForm';
import { getStudent } from '../../../tenant/students/_queries/queries';

export const metadata: Metadata = { title: 'Student Detail - Parent Dashboard', alternates: { canonical: '/dashboard/parent/students' } };

export default async function ParentStudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getStudent(id);
  return <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6"><Link href="/dashboard/parent/students" className="text-sm font-semibold text-blue-700">Kembali ke daftar anak</Link>{result.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.error}</div>}{result.data ? <><header className="border-b border-gray-200 pb-5"><h1 className="text-2xl font-bold text-gray-900">{result.data.full_name}</h1><p className="mt-1 text-sm text-gray-500">Detail dan perubahan data anak.</p></header><StudentForm student={result.data} /></> : <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Student tidak ditemukan atau tidak dapat diakses.</div>}</main>;
}