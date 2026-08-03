'use client';

import { useActionState } from 'react';
import { updateEnrollmentStatus, type ActionResponse } from '../_actions/actions';

export function EnrollmentStatusForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(updateEnrollmentStatus, { success: false, message: '' } satisfies ActionResponse);
  return <form action={action} className="flex items-center gap-2"><input type="hidden" name="enrollment_id" value={id} /><select name="status" defaultValue={status} className="min-h-10 rounded-lg border border-gray-300 px-2 text-sm"><option value="pending">Pending</option><option value="active">Active</option><option value="completed">Completed</option><option value="dropped">Dropped</option></select><button disabled={pending} className="min-h-10 rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white disabled:opacity-50">Simpan</button>{state.message && <span role="status" className="text-xs text-emerald-700">{state.message}</span>}</form>;
}