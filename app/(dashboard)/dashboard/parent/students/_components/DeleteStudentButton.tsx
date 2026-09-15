'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteStudent } from '../_actions/actions';
import type { StudentActionState } from '@/lib/students';

const initialState: StudentActionState = { success: false, message: '' };

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="text-sm font-bold text-[#b42318] hover:underline disabled:opacity-50">
      {pending ? 'Menghapus…' : 'Hapus'}
    </button>
  );
}

export function DeleteStudentButton({ studentId }: { studentId: string }) {
  const [state, formAction] = useActionState(deleteStudent, initialState);
  return (
    <div>
      <form action={formAction} onSubmit={(event) => { if (!window.confirm('Hapus profil student ini?')) event.preventDefault(); }}>
        <input type="hidden" name="student_id" value={studentId} />
        <DeleteSubmitButton />
      </form>
      {state.message && <p role={state.success ? 'status' : 'alert'} className={`mt-2 max-w-xs text-xs ${state.success ? 'text-[#31551d]' : 'text-[#b42318]'}`}>{state.message}</p>}
    </div>
  );
}
