'use client';

import type { Student } from '@/lib/api/types';
import Link from 'next/link';
import { DeleteStudentButton } from './DeleteStudentButton';

function getStudentName(student: Student): string {
  return [student.first_name, student.last_name].filter(Boolean).join(' ');
}

function formatDate(value?: string | null): string {
  if (!value) return 'Tidak tersedia';
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'long' });
}

export function StudentList({ students, parentPath }: { students: Student[]; parentPath: string }) {
  if (students.length === 0) return <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600"><p>Belum ada data anak.</p><Link href={`${parentPath}?create=1`} className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 font-semibold text-white">Tambah anak pertama</Link></div>;

  return <div className="space-y-3">{students.map((student) => {
    const name = getStudentName(student);
    return <article key={student.id} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0"><h2 className="truncate font-semibold text-gray-900">{name}</h2><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500"><span>Lahir: {formatDate(student.date_of_birth)}</span>{student.nickname && <span>Panggilan: {student.nickname}</span>}</div></div>
      <div className="flex flex-wrap gap-2"><Link href={`${parentPath}/${student.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">Detail</Link><Link href={`${parentPath}/${student.id}?edit=1`} className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">Edit</Link><DeleteStudentButton studentId={student.id} studentName={name} /></div>
    </article>;
  })}</div>;
}