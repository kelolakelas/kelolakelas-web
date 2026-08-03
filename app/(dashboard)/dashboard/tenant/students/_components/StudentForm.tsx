'use client';

import { useActionState } from 'react';
import { saveStudent, type StudentActionResponse } from '../_actions/actions';

const initialState: StudentActionResponse = { success: false, message: '' };

export function StudentForm({ student }: { student?: { id: string; full_name: string; date_of_birth?: string | null } }) {
  const [state, action, pending] = useActionState(saveStudent, initialState);
  return <form action={action} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
    {student && <input type="hidden" name="id" value={student.id} />}
    {state.message && <p role="status" className={state.success ? 'rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800' : 'rounded-lg bg-red-50 p-3 text-sm text-red-800'}>{state.message}</p>}
    <label className="block text-sm font-medium text-gray-800">Nama lengkap<input name="full_name" required defaultValue={student?.full_name} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3" /></label>
    <label className="block text-sm font-medium text-gray-800">Tanggal lahir<input name="date_of_birth" type="date" required defaultValue={student?.date_of_birth?.slice(0, 10)} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3" /></label>
    {state.errors && <p className="text-sm text-red-700">{Object.values(state.errors).flat().join(' ')}</p>}
    <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Menyimpan...' : student ? 'Simpan perubahan' : 'Tambah student'}</button>
  </form>;
}