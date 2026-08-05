import type { Metadata } from 'next';
import Link from 'next/link';
import { getParentStudent } from '../../_queries/queries';
import { DeleteStudentButton } from '../_components/DeleteStudentButton';
import { StudentForm } from '../_components/StudentForm';

export const metadata: Metadata = { title: 'Student Detail - Parent Dashboard', alternates: { canonical: '/dashboard/parent/students' } };

export default async function ParentStudentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const result = await getParentStudent(id);
  const name = result.data ? [result.data.first_name, result.data.last_name].filter(Boolean).join(' ') : '';
  return <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6"><Link href="/dashboard/parent/students" className="text-sm font-semibold text-blue-700">Kembali ke daftar anak</Link>{result.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.error}</div>}{result.data ? query.edit === '1' ? <section className="space-y-4"><div><h1 className="text-2xl font-bold text-gray-900">Edit {name}</h1><p className="mt-1 text-sm text-gray-500">Perbarui data anak.</p></div><StudentForm student={result.data} /></section> : <><header className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold text-gray-900">{name}</h1><p className="mt-1 text-sm text-gray-500">Detail student dari akun orang tua ini.</p></div><div className="flex gap-2"><Link href={`/dashboard/parent/students/${id}?edit=1`} className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700">Edit</Link><DeleteStudentButton studentId={id} studentName={name} /></div></header><div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-700"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-gray-500">Nama panggilan</dt><dd className="mt-1 font-medium">{result.data.nickname || 'Tidak tersedia'}</dd></div><div><dt className="text-gray-500">Jenis kelamin</dt><dd className="mt-1 font-medium">{result.data.gender === 'male' ? 'Laki-laki' : result.data.gender === 'female' ? 'Perempuan' : 'Tidak tersedia'}</dd></div><div><dt className="text-gray-500">Tanggal lahir</dt><dd className="mt-1 font-medium">{result.data.date_of_birth || 'Tidak tersedia'}</dd></div></dl></div></> : <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Student tidak ditemukan atau tidak dapat diakses.</div>}</main>;
}