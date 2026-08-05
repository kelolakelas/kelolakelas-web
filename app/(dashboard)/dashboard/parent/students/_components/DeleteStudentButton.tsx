'use client';

import { LoaderCircle, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteStudent, type StudentActionResponse } from '../_actions/actions';

const initialState: StudentActionResponse = { success: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}{pending ? 'Menghapus...' : 'Hapus anak'}</button>;
}

export function DeleteStudentButton({ studentId, studentName }: { studentId: string; studentName: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(deleteStudent, initialState);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!state.success) return;
    dialogRef.current?.close();
    const toastTimer = window.setTimeout(() => setToast(state.message), 0);
    router.refresh();
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => {
      window.clearTimeout(toastTimer);
      window.clearTimeout(timer);
    };
  }, [router, state]);

  return <>
    <button type="button" onClick={() => !pending && dialogRef.current?.showModal()} disabled={pending} title={`Hapus ${studentName}`} aria-label={`Hapus ${studentName}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
    <dialog ref={dialogRef} onCancel={(event) => { if (pending) event.preventDefault(); }} className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-gray-950/50">
      <div className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">Hapus anak?</h2><p className="mt-2 text-sm leading-6 text-gray-600"><strong>{studentName}</strong> akan dihapus. Student dengan enrollment aktif tidak dapat dihapus.</p></div><button type="button" onClick={() => !pending && dialogRef.current?.close()} disabled={pending} aria-label="Tutup dialog" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div><form action={formAction} className="mt-6 space-y-4"><input type="hidden" name="id" value={studentId} />{state.message && !state.success && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.message}</p>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => !pending && dialogRef.current?.close()} disabled={pending} className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 disabled:opacity-50">Batal</button><SubmitButton /></div></form></div>
    </dialog>
    {toast && <div role="status" className="fixed inset-x-4 bottom-4 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg sm:left-auto sm:w-auto">{toast}</div>}
  </>;
}