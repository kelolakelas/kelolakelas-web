import type { Metadata } from 'next';
import Link from 'next/link';
import { StudentForm } from '../_components/StudentForm';
import { getStudent } from '../_queries/queries';

export const metadata: Metadata = { title: 'Student Detail - Tenant Dashboard', alternates: { canonical: '/dashboard/tenant/students' } };

export default async function TenantStudentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const result = await getStudent(id);
  const student = result.data;
  const name = student ? [student.first_name, student.last_name].filter(Boolean).join(' ') : '';

  return <main className="mx-auto w-full max-w-3xl space-y-6"><Link href="/dashboard/tenant/students" className="text-sm font-semibold text-blue-700">Kembali ke direktori</Link>{result.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{result.error}</div>}{student ? query.edit === '1' ? <section className="space-y-4"><div><h1 className="text-2xl font-bold text-slate-950">Edit {name}</h1><p className="mt-2 text-sm text-slate-600">Perbarui data student dan catatan tambahannya.</p></div><StudentForm student={student} /></section> : <><header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-blue-700">Detail student</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{name}</h1><p className="mt-2 text-sm text-slate-600">Data student dalam scope tenant ini.</p></div><Link href={`/dashboard/tenant/students/${id}?edit=1`} className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">Edit</Link></header><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><dl className="grid gap-5 sm:grid-cols-2"><div><dt className="text-sm text-slate-600">Nama panggilan</dt><dd className="mt-1 font-medium text-slate-950">{student.nickname || 'Tidak tersedia'}</dd></div><div><dt className="text-sm text-slate-600">Jenis kelamin</dt><dd className="mt-1 font-medium text-slate-950">{student.gender === 'male' ? 'Laki-laki' : student.gender === 'female' ? 'Perempuan' : 'Tidak tersedia'}</dd></div><div><dt className="text-sm text-slate-600">Tanggal lahir</dt><dd className="mt-1 font-medium text-slate-950">{student.date_of_birth || 'Tidak tersedia'}</dd></div><div><dt className="text-sm text-slate-600">Jumlah catatan</dt><dd className="mt-1 font-medium text-slate-950">{student.student_notes?.length || 0}</dd></div></dl></div></> : <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Student tidak ditemukan atau tidak dapat diakses.</div>}</main>;
}
