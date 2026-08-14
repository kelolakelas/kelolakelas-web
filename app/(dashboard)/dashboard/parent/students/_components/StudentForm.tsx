'use client';

import type { Student } from '@/lib/api/types';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
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
  const [noteCount, setNoteCount] = useState(student?.student_notes?.length || 1);
  const formRef = useRef<HTMLFormElement>(null);
  const draftRef = useRef<Record<string, string[]>>({});

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  useEffect(() => {
    if (state.success || !state.message || !formRef.current) return;
    const fields = formRef.current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[name]');
    const values = draftRef.current;
    fields.forEach((field) => {
      const fieldValues = values[field.name];
      if (fieldValues?.length) field.value = fieldValues.shift() || '';
    });
  }, [state]);

  const errors = state.errors || {};
  return <form ref={formRef} action={formAction} onSubmit={() => { const formData = new FormData(formRef.current || undefined); draftRef.current = {}; formData.forEach((value, name) => { (draftRef.current[name] ||= []).push(String(value)); }); }} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    {student && <input type="hidden" name="id" value={student.id} />}
    {state.message && <p role={state.success ? 'status' : 'alert'} className={state.success ? 'rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800' : 'rounded-lg bg-red-50 p-3 text-sm text-red-800'}>{state.message}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nama depan" name="first_name" required defaultValue={student?.first_name} error={errors.first_name} />
      <Field label="Nama belakang" name="last_name" defaultValue={student?.last_name || ''} error={errors.last_name} />
      <Field label="Nama panggilan" name="nickname" defaultValue={student?.nickname || ''} error={errors.nickname} />
      <label className="block text-sm font-medium text-gray-800">Jenis kelamin<select name="gender" defaultValue={student?.gender || ''} className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3"><option value="">Pilih jika ingin diisi</option><option value="male">Laki-laki</option><option value="female">Perempuan</option></select>{errors.gender && <ErrorText messages={errors.gender} />}</label>
      <Field label="Tanggal lahir" name="date_of_birth" type="date" required defaultValue={student?.date_of_birth?.slice(0, 10)} error={errors.date_of_birth} />
    </div>
    <div className="border-t border-slate-200 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-base font-semibold text-slate-950">Catatan tambahan</h2><p className="mt-1 text-sm text-slate-600">Tambahkan informasi penting tentang anak. Setiap catatan bisa memiliki jenis berbeda.</p></div><button type="button" onClick={() => setNoteCount((count) => count + 1)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">+ Tambah catatan</button></div>
      <div className="mt-4 space-y-4">{Array.from({ length: noteCount }, (_, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-slate-800">Catatan {index + 1}</span>{noteCount > 1 && <button type="button" onClick={() => setNoteCount((count) => count - 1)} className="min-h-11 px-2 text-sm font-semibold text-red-700 hover:text-red-800">Hapus</button>}</div><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-800">Jenis catatan<select name="note_type" defaultValue={student?.student_notes?.[index]?.note_type || ''} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="">Pilih jenis catatan</option><option value="medical">Medis</option><option value="academic">Akademik</option><option value="behavioral">Perilaku</option></select></label><label className="block text-sm font-medium text-slate-800 sm:col-span-2">Isi catatan<textarea name="note_content" maxLength={5000} rows={3} defaultValue={student?.student_notes?.[index]?.content || ''} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" placeholder="Contoh: Alergi makanan tertentu" /></label></div></div>)}</div>
      {errors.student_notes && <ErrorText messages={errors.student_notes} />}
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