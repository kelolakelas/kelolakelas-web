'use client';

import type { Student } from '@/lib/api/types';
import { useActionState } from 'react';
import type { ClassEntity } from '../../classes/_lib/schema';
import { createEnrollment, type ActionResponse } from '../_actions/actions';

const initialState: ActionResponse = { success: false, message: '' };

export function EnrollmentForm({ classes, students }: { classes: ClassEntity[]; students: Student[] }) {
  const [state, action, pending] = useActionState(createEnrollment, initialState);
  return (
    <form action={action} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      {state.message && <p role="status" className={state.success ? 'rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800' : 'rounded-lg bg-red-50 p-3 text-sm text-red-800'}>{state.message}</p>}
      <label className="block text-sm font-medium">Student<select name="student_id" required className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3"><option value="">Pilih student</option>{students.map((student) => <option key={student.id} value={student.id}>{[student.first_name, student.last_name].filter(Boolean).join(' ')}</option>)}</select></label>
      <label className="block text-sm font-medium">Class<select name="class_id" required className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3"><option value="">Pilih class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="block text-sm font-medium">Billing cycle<select name="billing_cycle" defaultValue="monthly" className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label>
      <label className="block text-sm font-medium">Platform fee (rupiah)<input name="platform_fee" type="number" min="0" step="1" defaultValue="0" className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3" /></label>
      <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Menyimpan...' : 'Buat enrollment'}</button>
    </form>
  );
}
