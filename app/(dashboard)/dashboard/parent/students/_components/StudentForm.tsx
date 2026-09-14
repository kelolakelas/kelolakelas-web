'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createStudent, updateStudent } from '../_actions/actions';
import {
  dateInputValue,
  type Student,
  type StudentActionState,
} from '@/lib/students';

const initialState: StudentActionState = { success: false, message: '' };

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-[#17231f] px-5 font-bold text-white transition hover:bg-[#31463d] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Tambah student'}
    </button>
  );
}

function FieldError({ errors, name }: { errors?: Record<string, string[]>; name: string }) {
  const message = errors?.[name]?.[0];
  return message ? <p className="mt-1 text-sm text-[#b42318]">{message}</p> : null;
}

export function StudentForm({ student, onCancel }: { student?: Student; onCancel: () => void }) {
  const editing = Boolean(student);
  const [state, formAction] = useActionState(editing ? updateStudent : createStudent, initialState);

  return (
    <form action={formAction} className="space-y-5 rounded-3xl border border-[#dfe3d7] bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.14em] text-[#617c35]">{editing ? 'Edit profil' : 'Profil baru'}</p>
          <h2 className="mt-1 text-2xl font-black">{editing ? 'Perbarui data student' : 'Tambahkan student'}</h2>
        </div>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-[#617c35] hover:underline">
          Tutup
        </button>
      </div>

      {student && <input type="hidden" name="student_id" value={student.id} />}

      {state.message && (
        <p role={state.success ? 'status' : 'alert'} className={`rounded-2xl p-3 text-sm font-medium ${state.success ? 'bg-[#e8f3df] text-[#31551d]' : 'bg-[#fde8e7] text-[#8e2119]'}`}>
          {state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="first_name" className="text-sm font-bold">Nama depan <span aria-hidden="true">*</span></label>
          <input id="first_name" name="first_name" required maxLength={255} defaultValue={student?.first_name || ''} className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] px-3" />
          <FieldError errors={state.errors} name="first_name" />
        </div>
        <div>
          <label htmlFor="last_name" className="text-sm font-bold">Nama belakang</label>
          <input id="last_name" name="last_name" maxLength={255} defaultValue={student?.last_name || student?.['lastå_name'] || ''} className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] px-3" />
          <FieldError errors={state.errors} name="last_name" />
        </div>
        <div>
          <label htmlFor="nickname" className="text-sm font-bold">Nama panggilan</label>
          <input id="nickname" name="nickname" maxLength={100} defaultValue={student?.nickname || ''} className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] px-3" />
          <FieldError errors={state.errors} name="nickname" />
        </div>
        <div>
          <label htmlFor="gender" className="text-sm font-bold">Jenis kelamin</label>
          <select id="gender" name="gender" defaultValue={student?.gender || ''} className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3">
            <option value="">Pilih jika ingin mengisi</option>
            <option value="female">Perempuan</option>
            <option value="male">Laki-laki</option>
          </select>
          <FieldError errors={state.errors} name="gender" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="date_of_birth" className="text-sm font-bold">Tanggal lahir <span aria-hidden="true">*</span></label>
          <input id="date_of_birth" name="date_of_birth" type="date" required defaultValue={dateInputValue(student?.date_of_birth)} className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] px-3 sm:max-w-xs" />
          <FieldError errors={state.errors} name="date_of_birth" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton editing={editing} />
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-[#c8d0c5] px-5 font-bold text-[#31463d] hover:bg-[#f3f6ef]">Batal</button>
      </div>
    </form>
  );
}
