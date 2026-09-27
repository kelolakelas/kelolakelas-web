'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (state.success && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [state]);

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          dialogRef.current?.showModal();
          setDialogOpen(true);
        }}
        className="text-sm font-bold text-[#b42318] hover:underline"
      >
        Hapus
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-student-title-${studentId}`}
        className="max-w-md rounded-3xl border border-[#dfe3d7] bg-white p-6 text-[#17231f] backdrop:bg-black/40"
        onClose={() => {
          setDialogOpen(false);
          triggerRef.current?.focus();
        }}
      >
        <h2 id={`delete-student-title-${studentId}`} className="text-xl font-black">
          Hapus profil student ini?
        </h2>
        <p className="mt-3 text-sm text-[#52615b]">
          Profil student akan dihapus dan tindakan ini tidak dapat diurungkan.
        </p>

        <form action={formAction} className="mt-6 flex flex-wrap justify-end gap-3">
          <input type="hidden" name="student_id" value={studentId} />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-11 rounded-xl border border-[#dfe3d7] bg-white px-4 text-sm font-bold text-[#365047]"
          >
            Batal
          </button>
          <DeleteSubmitButton />
        </form>

        {dialogOpen && !state.success && state.message && (
          <p role="alert" className="mt-4 text-sm text-[#b42318]">
            {state.message}
          </p>
        )}
      </dialog>

      {state.success && state.message && (
        <p role="status" className="mt-2 max-w-xs text-xs text-[#31551d]">
          {state.message}
        </p>
      )}
    </div>
  );
}
