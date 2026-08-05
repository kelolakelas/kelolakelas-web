'use client';

import type { Student } from '@/lib/api/types';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { saveStudent, type StudentActionResponse } from '../_actions/actions';

const initialState: StudentActionResponse = { success: false, message: '' };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{pending ? 'Menyimpan...' : isEditing ? 'Simpan perubahan' : 'Tambah anak'}</button>;
}

export function StudentForm({ student }: { student?: Student }) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveStudent, initialState);
  const isEditing = Boolean(student);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  const errors = state.errors || {};
  return <form action={formAction} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
    {student && <input type="hidden" name="id" value={student.id} />}
    {state.message && <p role={state.success ? 'status' : 'alert'} className={state.success ? 'rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800' : 'rounded-lg bg-red-50 p-3 text-sm text-red-800'}>{state.message}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nama depan" name="first_name" required defaultValue={student?.first_name} error={errors.first_name} />
      <Field label="Nama belakang" name="last_name" defaultValue={student?.last_name || ''} error={errors.last_name} />
      <Field label="Nama panggilan" name="nickname" defaultValue={student?.nickname || ''} error={errors.nickname} />
      <label className="block text-sm font-medium text-gray-800">Jenis kelamin<select name="gender" defaultValue={student?.gender || ''} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3"><option value="">Pilih jika ingin diisi</option><option value="male">Laki-laki</option><option value="female">Perempuan</option></select>{errors.gender && <ErrorText messages={errors.gender} />}</label>
      <Field label="Tanggal lahir" name="date_of_birth" type="date" required defaultValue={student?.date_of_birth?.slice(0, 10)} error={errors.date_of_birth} />
    </div>
    <div className="border-t border-gray-100 pt-5">
      <h2 className="text-sm font-semibold text-gray-900">Catatan tambahan</h2>
      <p className="mt-1 text-xs text-gray-500">Catatan lama tidak dikirim kembali oleh API saat membuka form edit.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-gray-800">Jenis catatan<select name="note_type" defaultValue="" className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3"><option value="">Pilih jenis catatan</option><option value="medical">Medis</option><option value="academic">Akademik</option><option value="behavioral">Perilaku</option></select>{errors.student_note && <ErrorText messages={errors.student_note} />}</label>
        <label className="block text-sm font-medium text-gray-800 sm:col-span-2">Isi catatan<textarea name="note_content" maxLength={5000} rows={4} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Opsional" />{errors.student_note && <ErrorText messages={errors.student_note} />}</label>
      </div>
    </div>
    <div className="flex justify-end"><SubmitButton isEditing={isEditing} /></div>
  </form>;
}

function Field({ label, name, type = 'text', required, defaultValue, error }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; error?: string[] }) {
  const errorId = `${name}-error`;
  return <label className="block text-sm font-medium text-gray-800">{label}{required && <span aria-hidden="true"> *</span>}<input name={name} type={type} required={required} defaultValue={defaultValue} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3" />{error && <ErrorText id={errorId} messages={error} />}</label>;
}

function ErrorText({ id, messages }: { id?: string; messages: string[] }) {
  return <span id={id} className="mt-1 block text-xs font-normal text-red-700">{messages.join(' ')}</span>;
}