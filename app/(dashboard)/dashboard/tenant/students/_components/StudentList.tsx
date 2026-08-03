'use client';

import type { Student } from '@/lib/api/types';
import Link from 'next/link';
import { useActionState } from 'react';
import { deleteStudent, type StudentActionResponse } from '../_actions/actions';

const initialState: StudentActionResponse = { success: false, message: '' };

export function StudentList({ students, canMutate, parentPath }: { students: Student[]; canMutate: boolean; parentPath: string }) {
  const [state, action, pending] = useActionState(deleteStudent, initialState);
  if (students.length === 0) return <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">Belum ada student pada scope akun ini.</div>;
  return <div className="space-y-3">
    {state.message && <p role="status" className={state.success ? 'rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800' : 'rounded-lg bg-red-50 p-3 text-sm text-red-800'}>{state.message}</p>}
    {students.map((student) => <article key={student.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="font-semibold text-gray-900">{student.full_name}</h2><p className="text-sm text-gray-500">Lahir: {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('id-ID') : 'Tidak tersedia'}</p><p className="mt-1 text-xs text-gray-400">ID: {student.id}</p></div>
      <div className="flex flex-wrap gap-2"><Link href={`${parentPath}/${student.id}`} className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-3 text-sm font-semibold">Detail</Link>{canMutate && <><Link href={`${parentPath}/${student.id}?edit=1`} className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700">Edit</Link><form action={action} onSubmit={(event) => { if (!window.confirm(`Hapus ${student.full_name}? Student dengan enrollment aktif tidak dapat dihapus.`)) event.preventDefault(); }}><input type="hidden" name="id" value={student.id} /><button disabled={pending} className="min-h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50">Hapus</button></form></>}</div>
    </article>)}
  </div>;
}