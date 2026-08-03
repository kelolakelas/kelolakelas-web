'use client';

import type { Member } from '@/lib/api/types';
import { useActionState } from 'react';
import { rescheduleSession, substituteTutor } from '../_actions/actions';
import type { SessionActionResponse } from '../_lib/schema';

const initialState: SessionActionResponse = { success: false, message: '' };

export function SessionActions({ sessionId, tutors }: { sessionId: string; tutors: Member[] }) {
  const [rescheduleState, rescheduleAction, isRescheduling] = useActionState(rescheduleSession, initialState);
  const [tutorState, tutorAction, isAssigningTutor] = useActionState(substituteTutor, initialState);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form action={rescheduleAction} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
        <input type="hidden" name="sessionId" value={sessionId} />
        <div><h2 className="font-semibold text-gray-900">Jadwalkan ulang</h2><p className="mt-1 text-xs text-gray-500">Perubahan ini hanya berlaku untuk session yang dipilih.</p></div>
        <label className="block text-sm font-medium text-gray-700">Tanggal baru<input name="newSessionDate" type="date" required className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-gray-700">Mulai<input name="newStartTime" type="time" required className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3" /></label>
          <label className="text-sm font-medium text-gray-700">Selesai<input name="newEndTime" type="time" required className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3" /></label>
        </div>
        <label className="block text-sm font-medium text-gray-700">Lokasi baru<input name="newLocation" className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3" /></label>
        {rescheduleState.message && <p role="status" className={rescheduleState.success ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>{rescheduleState.message}</p>}
        <button type="submit" disabled={isRescheduling} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">{isRescheduling ? 'Menyimpan...' : 'Simpan jadwal'}</button>
      </form>

      <form action={tutorAction} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
        <input type="hidden" name="sessionId" value={sessionId} />
        <div><h2 className="font-semibold text-gray-900">Ganti tutor</h2><p className="mt-1 text-xs text-gray-500">Tutor dipilih dari sistem identity.</p></div>
        {tutors.length === 0 ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Daftar tutor tidak tersedia untuk context ini.</p> : <label className="block text-sm font-medium text-gray-700">Tutor pengganti<select name="substituteTutorId" required className="mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3"><option value="">Pilih tutor</option>{tutors.map((tutor) => <option key={tutor.id || tutor.user_id} value={tutor.id || tutor.user_id}>{`${tutor.first_name || ''} ${tutor.last_name || ''}`.trim() || tutor.email}</option>)}</select></label>}
        {tutorState.message && <p role="status" className={tutorState.success ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>{tutorState.message}</p>}
        <button type="submit" disabled={isAssigningTutor} className="min-h-11 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-60">{isAssigningTutor ? 'Menyimpan...' : 'Tetapkan tutor'}</button>
      </form>
    </div>
  );
}