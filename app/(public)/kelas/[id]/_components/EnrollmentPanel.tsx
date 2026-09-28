'use client';

import Link from 'next/link';
import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { enrollInClass } from '../_actions/actions';
import { StudentForm } from '@/app/(dashboard)/dashboard/parent/students/_components/StudentForm';
import type { CatalogScheduleOption } from '@/lib/catalog';
import type { EnrollmentActionState } from '@/lib/enrollment';
import { studentLastName, type Student } from '@/lib/students';
import type { EnrollmentLinkCandidate, ScheduleRequest } from '@/lib/schedule-request';
import { ScheduleRequestForm } from './ScheduleRequestForm';
import { ScheduleRequestList } from './ScheduleRequestList';

const initialState: EnrollmentActionState = { success: false, message: '' };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} className="min-h-11 rounded-xl bg-[#17231f] px-5 font-bold text-white transition hover:bg-[#31463d] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Menyiapkan checkout…' : 'Lanjut ke pembayaran'}</button>;
}

function FieldError({ errors, name }: { errors?: Record<string, string[]>; name: string }) {
  const message = errors?.[name]?.[0];
  return message ? <p className="mt-1 text-sm text-[#b42318]">{message}</p> : null;
}

/**
 * Enrollment entry point on the class detail page.
 *
 * - Group classes keep the checkout flow: the parent picks a student and a
 *   fixed schedule, then continues to payment.
 * - Private classes (KEL-109) show a schedule request form instead of
 *   "Lanjut ke pembayaran": the parent proposes weekly slots, and the tenant
 *   reviews the request. The parent's requests for this class are listed below
 *   the form with their status, a cancel control for pending rows, and a
 *   resubmit option for rejected rows.
 */
export function EnrollmentPanel({ classId, classType, isParent, students, schedules, idempotencyKey, studentError, scheduleRequests = [], enrollments = [] }: {
  classId: string;
  classType: 'private' | 'group';
  isParent: boolean;
  students: Student[];
  schedules: CatalogScheduleOption[];
  idempotencyKey: string;
  studentError?: string;
  scheduleRequests?: ScheduleRequest[];
  enrollments?: EnrollmentLinkCandidate[];
}) {
  const [state, formAction] = useActionState(enrollInClass.bind(null, classId), initialState);
  const [studentOptions, setStudentOptions] = useState(students);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resubmitSeed, setResubmitSeed] = useState(0);
  const [resubmitFrom, setResubmitFrom] = useState<ScheduleRequest | undefined>(undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!dialogOpen) return;
    dialogRef.current?.querySelector<HTMLInputElement>('#first_name')?.focus();
  }, [dialogOpen]);

  const openStudentDialog = () => {
    dialogRef.current?.showModal();
    setDialogOpen(true);
  };

  const closeStudentDialog = () => dialogRef.current?.close();

  const handleStudentCreated = useCallback((student: Student) => {
    setStudentOptions((current) => current.some((item) => item.id === student.id) ? current : [...current, student]);
    setSelectedStudentId(student.id);
    dialogRef.current?.close();
  }, []);

  if (!isParent) {
    return <section className="mt-10 rounded-3xl border border-[#dfe3d7] bg-[#eef3dd] p-6"><h2 className="text-xl font-black">Siap mendaftar?</h2><p className="mt-2 text-[#52615b]">Masuk sebagai parent untuk memilih student dan melanjutkan ke checkout.</p><Link className="mt-5 inline-block rounded-xl bg-[#17231f] px-5 py-3 font-bold text-white" href={`/login?redirectTo=${encodeURIComponent(`/kelas/${classId}`)}`}>Masuk untuk mendaftar</Link></section>;
  }

  if (studentError) return <section className="mt-10 rounded-3xl border border-[#f2c6c3] bg-white p-6" role="alert"><h2 className="text-xl font-black">Student belum dapat dimuat.</h2><p className="mt-2 text-[#52615b]">{studentError}</p><Link className="mt-4 inline-block font-bold text-[#617c35] underline" href="/dashboard/parent/students">Kelola student</Link></section>;
  if (!studentOptions.length) return <section className="mt-10 rounded-3xl border border-dashed border-[#c8d0c5] bg-white p-6"><h2 className="text-xl font-black">Tambahkan student terlebih dahulu.</h2><p className="mt-2 text-[#52615b]">Enrollment membutuhkan profil student milik parent.</p><button ref={triggerRef} type="button" onClick={openStudentDialog} className="mt-4 rounded-xl bg-[#617c35] px-5 py-3 font-bold text-white">Tambah student</button><dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`create-student-title-${classId}`} className="max-w-2xl rounded-3xl border border-[#dfe3d7] bg-[#f8f7f3] p-0 text-[#17231f] backdrop:bg-black/40" onCancel={closeStudentDialog} onClose={() => { setDialogOpen(false); triggerRef.current?.focus(); }}><div className="p-6 sm:p-8"><h2 id={`create-student-title-${classId}`} className="sr-only">Tambah student</h2><StudentForm autoFocus onCancel={closeStudentDialog} onSuccess={handleStudentCreated} /></div></dialog></section>;

  if (classType === 'private') {
    return (
      <section className="mt-10 rounded-3xl border border-[#dfe3d7] bg-[#eef3dd] p-6 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[.14em] text-[#617c35]">Permintaan jadwal private</p>
        <h2 className="mt-2 text-2xl font-black">Ajukan jadwal les private</h2>
        <p className="mt-2 text-[#52615b]">Usulkan slot mingguan; penyelenggara meninjau permintaan Anda sebelum enrollment dibuat. Kelas private tidak melalui checkout dari halaman ini.</p>
        <div id="form-permintaan-jadwal">
          <ScheduleRequestForm
            key={resubmitSeed}
            classId={classId}
            students={studentOptions}
            initialStudentId={selectedStudentId}
            resubmitFrom={resubmitFrom}
          />
        </div>
        <ScheduleRequestList
          requests={scheduleRequests}
          students={studentOptions}
          enrollments={enrollments}
          onResubmit={(request) => {
            setResubmitFrom(request);
            setResubmitSeed((seed) => seed + 1);
            document.getElementById('form-permintaan-jadwal')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </section>
    );
  }

  if (classType === 'group' && !schedules.length) return <section className="mt-10 rounded-3xl border border-[#f2c6c3] bg-white p-6" role="alert"><h2 className="text-xl font-black">Jadwal belum tersedia.</h2><p className="mt-2 text-[#52615b]">Kelas grup belum memiliki jadwal yang dapat dipilih. Coba lagi nanti atau hubungi penyelenggara.</p></section>;

  const availableSchedules = schedules.filter((schedule) => schedule.available);
  return <section className="mt-10 rounded-3xl border border-[#dfe3d7] bg-[#eef3dd] p-6 sm:p-8"><p className="text-sm font-bold uppercase tracking-[.14em] text-[#617c35]">Enrollment parent</p><h2 className="mt-2 text-2xl font-black">Pilih student dan jadwal</h2><p className="mt-2 text-[#52615b]">Harga dan status pembayaran ditentukan oleh backend setelah enrollment tervalidasi.</p><form action={formAction} className="mt-6 space-y-5">
    {state.message && <div role={state.success ? 'status' : 'alert'} className={`rounded-2xl p-3 text-sm font-medium ${state.success ? 'bg-[#e8f3df] text-[#31551d]' : 'bg-[#fde8e7] text-[#8e2119]'}`}><p>{state.message}</p>{state.link && <Link className="mt-2 inline-block font-bold underline" href={state.link.href}>{state.link.label}</Link>}</div>}
    <div><label htmlFor="enrollment-student" className="text-sm font-bold">Student</label><select id="enrollment-student" name="student_id" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} required className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3"><option value="">Pilih student</option>{studentOptions.map((student) => <option value={student.id} key={student.id}>{student.first_name}{studentLastName(student) ? ` ${studentLastName(student)}` : ''}{student.nickname ? ` (${student.nickname})` : ''}</option>)}</select><FieldError errors={state.errors} name="student_id" /></div>
    <div><label htmlFor="enrollment-schedule" className="text-sm font-bold">Jadwal</label><select id="enrollment-schedule" name="schedule_id" required={schedules.length > 0} disabled={!availableSchedules.length} className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3"><option value="">{availableSchedules.length ? 'Pilih jadwal' : 'Tidak ada jadwal yang tersedia'}</option>{schedules.map((schedule) => <option value={schedule.id} key={schedule.id} disabled={!schedule.available}>{schedule.label}{schedule.available ? (schedule.availableSlots !== undefined ? ` · ${schedule.availableSlots} slot` : '') : ' · penuh'}</option>)}</select>{!availableSchedules.length && schedules.length > 0 && <p className="mt-1 text-sm text-[#8e2119]">Semua jadwal sedang penuh. Coba lagi setelah ada slot tersedia.</p>}<FieldError errors={state.errors} name="schedule_id" /></div>
    <div><label htmlFor="enrollment-cycle" className="text-sm font-bold">Periode pembayaran</label><select id="enrollment-cycle" name="billing_cycle" defaultValue="monthly" required className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3"><option value="monthly">Bulanan</option><option value="quarterly">Per tiga bulan</option><option value="yearly">Tahunan</option></select><FieldError errors={state.errors} name="billing_cycle" /></div>
    <input type="hidden" name="idempotency_key" value={idempotencyKey} />
    <p className="text-sm text-[#52615b]">Jika provider belum merespons, kirim ulang form ini untuk melanjutkan intent yang sama.</p>
    <SubmitButton disabled={!availableSchedules.length && schedules.length > 0} />
  </form></section>;
}
