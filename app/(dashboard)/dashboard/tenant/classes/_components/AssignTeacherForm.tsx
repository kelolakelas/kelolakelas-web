'use client';

import { useState, useTransition } from 'react';
import { assignScheduleTeacher, getScheduleTeachers } from '../_actions/classActions';
import type { ClassSchedule } from '../_lib/schema';
import type { ScheduleTeachersRead } from '../_lib/teachers';

export function AssignTeacherForm({ schedule }: { schedule: ClassSchedule }) {
  const [open, setOpen] = useState(false);
  const [teachers, setTeachers] = useState<ScheduleTeachersRead | null>(null);
  const [teacher, setTeacher] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  return <div className="space-y-2">
    <p className="text-xs">{schedule.tutor_id ? 'Teacher ditugaskan' : 'Belum ditugaskan'}</p>
    {!schedule.tutor_id && !open && <button type="button" className="min-h-[44px] text-sm text-blue-700" onClick={() => {
      setOpen(true);
      startTransition(async () => { setTeachers(await getScheduleTeachers()); });
    }}>Tugaskan teacher</button>}
    {open && <form className="space-y-2" onSubmit={(event) => {
      event.preventDefault();
      startTransition(async () => {
        const result = await assignScheduleTeacher(schedule.id, teacher, date);
        setMessage(result.message);
        if (result.success) setOpen(false);
      });
    }}>
      {!teachers ? <p role="status">Memuat teacher...</p> : teachers.state !== 'ok' ?
        <p role="alert">{teachers.state === 'forbidden' ? 'Tidak memiliki akses daftar teacher.' : 'Daftar teacher tidak tersedia.'}</p> :
        teachers.teachers.length === 0 ? <p>Tidak ada teacher aktif.</p> : <>
          <label className="block text-xs">Teacher aktif
            <select required value={teacher} onChange={(event) => setTeacher(event.target.value)} className="block w-full rounded border p-2">
              <option value="">Pilih teacher</option>
              {teachers.teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="block text-xs">Mulai tanggal
            <input required type="date" value={date} min={schedule.valid_from?.slice(0, 10)} max={schedule.valid_until?.slice(0, 10)} onChange={(event) => setDate(event.target.value)} className="block w-full rounded border p-2" />
          </label>
          <button disabled={pending || !teacher} className="min-h-[44px] text-sm text-blue-700 disabled:opacity-50">{pending ? 'Menyimpan...' : 'Simpan penugasan'}</button>
        </>}
      <button type="button" disabled={pending} onClick={() => setOpen(false)} className="min-h-[44px] px-3 text-sm">Batal</button>
    </form>}
    {message && <p role="status" className="text-xs">{message}</p>}
  </div>;
}
