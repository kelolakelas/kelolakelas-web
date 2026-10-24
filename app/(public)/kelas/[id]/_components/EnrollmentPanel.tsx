'use client';

import Link from 'next/link';
import { startTransition, useActionState, useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { enrollInClass, previewClassVoucher } from '../_actions/actions';
import { StudentForm } from '@/app/(dashboard)/dashboard/parent/students/_components/StudentForm';
import type { CatalogScheduleOption } from '@/lib/catalog';
import { PAYMENT_CHANNEL_OPTIONS, type EnrollmentActionState, type VoucherPreviewState } from '@/lib/enrollment';
import { PaymentInstructionsPanel } from '@/app/_components/PaymentInstructionsPanel';
import { PAYMENT_RETURN_PATH } from '@/lib/payment-return';
import { parseMerchantOrderId } from '@/lib/payment-return';
import { studentLastName, type Student } from '@/lib/students';
import type { EnrollmentLinkCandidate, ScheduleRequest } from '@/lib/schedule-request';
import { ScheduleRequestForm } from './ScheduleRequestForm';
import { ScheduleRequestList } from './ScheduleRequestList';
import { checkoutAttemptStorageKey, matchesCheckoutAttempt, parseCheckoutAttempt, readCheckoutAttempt, saveCheckoutAttempt, subscribeCheckoutAttempts } from '@/lib/checkout-attempt';

const initialState: EnrollmentActionState = { success: false, message: '' };

function SubmitButton({ disabled, pending }: { disabled: boolean; pending: boolean }) {
  return <button type="submit" disabled={disabled || pending} aria-busy={pending} className="min-h-11 rounded-xl bg-[#17231f] px-5 font-bold text-white transition hover:bg-[#31463d] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Menyiapkan checkout…' : 'Lanjut ke pembayaran'}</button>;
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
 * - Parents who already have students can add another student from the same
 *   page (KEL-130): every branch with a loaded student list renders a
 *   "Tambah student" trigger that shares one dialog. The new student is
 *   appended to the options and selected immediately without leaving the page.
 */
export function EnrollmentPanel({ classId, classType, isParent, students, schedules, idempotencyKey, parentId, studentError, scheduleRequests = [], enrollments = [] }: {
  classId: string;
  classType: 'private' | 'group';
  isParent: boolean;
  students: Student[];
  schedules: CatalogScheduleOption[];
  idempotencyKey: string;
  parentId?: string;
  studentError?: string;
  scheduleRequests?: ScheduleRequest[];
  enrollments?: EnrollmentLinkCandidate[];
}) {
  const storageKey = classType === 'group' && isParent ? checkoutAttemptStorageKey(parentId, classId) : null;
  const stored = useSyncExternalStore(subscribeCheckoutAttempts, useCallback(() => readCheckoutAttempt(storageKey), [storageKey]), () => null);
  const restoredAttempt = parseCheckoutAttempt(stored);
  const [storageWarning, setStorageWarning] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [studentOptions, setStudentOptions] = useState(students);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedCycle, setSelectedCycle] = useState('monthly');
  const [selectedMethod, setSelectedMethod] = useState('VC');
  // KEL-194: the failing action echoes the raw submission in `state.values`.
  // The displayed picks are derived from that committed echo below (not via
  // setState in the dispatch wrapper: React resets the form DOM on action
  // completion, and state updates queued in that dispatch path were verified
  // live to be dropped for that update while the committed state kept the
  // echo). Fields the parent re-touches after the failure keep the fresh
  // edit; every other field shows the echoed submission.
  const [state, formAction, checkoutPending] = useActionState(async (_previous: EnrollmentActionState, formData: FormData) => {
    return enrollInClass(classId, _previous, formData);
  }, initialState);
  const failedValues = !state.success && state.values ? state.values : null;
  const failedKey = failedValues
    ? [failedValues.student_id, failedValues.schedule_id, failedValues.billing_cycle, failedValues.payment_method, failedValues.voucher_code].join('|')
    : '';
  // Previous-render comparison (React-sanctioned derived-state pattern): a
  // new failure echo resets the touched list, so a fresh mount carrying an
  // echo adopts it. No effect and no ref access during render.
  const [lastFailedKey, setLastFailedKey] = useState('');
  const [editedAfterFailure, setEditedAfterFailure] = useState<string[]>([]);
  if (failedKey !== lastFailedKey) {
    setLastFailedKey(failedKey);
    setEditedAfterFailure([]);
  }
  const markEditedAfterFailure = (field: string) => {
    setEditedAfterFailure((current) => (current.includes(field) ? current : [...current, field]));
  };
  const restoredValues = failedValues ?? restoredAttempt?.values;
  const shownValue = (field: 'student_id' | 'schedule_id' | 'billing_cycle' | 'payment_method' | 'voucher_code', local: string) =>
    restoredValues && !editedAfterFailure.includes(field) ? restoredValues[field] || local : local;
  const shownStudentId = shownValue('student_id', selectedStudentId);
  const shownScheduleId = shownValue('schedule_id', selectedScheduleId);
  const shownCycle = shownValue('billing_cycle', selectedCycle);
  const rawMethod = shownValue('payment_method', selectedMethod);
  // The owner approved SP for new group purchases. A saved NQ purchase keeps
  // its exact method/key; changing student is a new purchase, never a rewrite
  // of the old invoice. Private request options remain unchanged.
  const recoveringNQ = restoredValues?.payment_method === 'NQ' && shownStudentId === restoredValues.student_id;
  const shownMethod = rawMethod === 'NQ' && !recoveringNQ ? 'SP' : rawMethod;
  const groupPaymentOptions = PAYMENT_CHANNEL_OPTIONS.map(option =>
    option.value === 'NQ' && !recoveringNQ ? { ...option, value: 'SP' } : option,
  );
  const shownVoucher = shownValue('voucher_code', voucherCode);
  const [preview, setPreview] = useState<VoucherPreviewState | null>(null);
  const [previewPending, startPreview] = useTransition();
  const previewVersion = useRef(0);
  const [checkoutKey, setCheckoutKey] = useState(idempotencyKey);
  const recoveringAttempt = matchesCheckoutAttempt(restoredAttempt, { student_id: shownStudentId, schedule_id: shownScheduleId, billing_cycle: shownCycle, payment_method: shownMethod, voucher_code: shownVoucher });
  const effectiveCheckoutKey = recoveringAttempt ? restoredAttempt!.key : restoredAttempt && checkoutKey === idempotencyKey ? restoredAttempt.key : checkoutKey;
  const checkVoucher = () => {
    const version = ++previewVersion.current;
    setPreview(null);
    startPreview(async () => {
      const result = await previewClassVoucher(classId, shownVoucher);
      if (version === previewVersion.current) setPreview(result);
    });
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resubmitSeed, setResubmitSeed] = useState(0);
  const [resubmitFrom, setResubmitFrom] = useState<ScheduleRequest | undefined>(undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!dialogOpen) return;
    dialogRef.current?.querySelector<HTMLInputElement>('#first_name')?.focus();
  }, [dialogOpen]);

  const openStudentDialog = (event: { currentTarget: HTMLButtonElement }) => {
    openerRef.current = event.currentTarget;
    dialogRef.current?.showModal();
    setDialogOpen(true);
  };

  const closeStudentDialog = () => dialogRef.current?.close();

  const handleDialogClose = () => {
    setDialogOpen(false);
    (openerRef.current ?? triggerRef.current)?.focus();
  };

  const handleStudentCreated = useCallback((student: Student) => {
    setStudentOptions((current) => current.some((item) => item.id === student.id) ? current : [...current, student]);
    setSelectedStudentId(student.id);
    setCheckoutKey(crypto.randomUUID());
    markEditedAfterFailure('student_id');
    dialogRef.current?.close();
  }, []);

  if (!isParent) {
    return <section className="mt-10 rounded-3xl border border-[#dfe3d7] bg-[#eef3dd] p-6"><h2 className="text-xl font-black">Siap mendaftar?</h2><p className="mt-2 text-[#52615b]">Masuk sebagai parent untuk memilih student dan melanjutkan ke checkout.</p><Link className="mt-5 inline-block rounded-xl bg-[#17231f] px-5 py-3 font-bold text-white" href={`/login?redirectTo=${encodeURIComponent(`/kelas/${classId}`)}`}>Masuk untuk mendaftar</Link></section>;
  }

  if (studentError) return <section className="mt-10 rounded-3xl border border-[#f2c6c3] bg-white p-6" role="alert"><h2 className="text-xl font-black">Student belum dapat dimuat.</h2><p className="mt-2 text-[#52615b]">{studentError}</p><Link className="mt-4 inline-block font-bold text-[#617c35] underline" href="/dashboard/parent/students">Kelola student</Link></section>;

  const studentDialog = (
    <dialog ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`create-student-title-${classId}`} className="max-w-2xl rounded-3xl border border-[#dfe3d7] bg-[#f8f7f3] p-0 text-[#17231f] backdrop:bg-black/40" onCancel={closeStudentDialog} onClose={handleDialogClose}>
      <div className="p-6 sm:p-8">
        <h2 id={`create-student-title-${classId}`} className="sr-only">Tambah student</h2>
        <StudentForm autoFocus onCancel={closeStudentDialog} onSuccess={handleStudentCreated} />
      </div>
    </dialog>
  );

  const addStudentButton = (
    <button ref={triggerRef} type="button" onClick={openStudentDialog} className="mt-4 rounded-xl bg-[#617c35] px-5 py-3 font-bold text-white">Tambah student</button>
  );

  if (!studentOptions.length) return <section className="mt-10 rounded-3xl border border-dashed border-[#c8d0c5] bg-white p-6"><h2 className="text-xl font-black">Tambahkan student terlebih dahulu.</h2><p className="mt-2 text-[#52615b]">Enrollment membutuhkan profil student milik parent.</p>{addStudentButton}{studentDialog}</section>;

  if (classType === 'private') {
    return (
      <section className="mt-10 rounded-3xl border border-[#dfe3d7] bg-[#eef3dd] p-6 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[.14em] text-[#617c35]">Permintaan jadwal private</p>
        <h2 className="mt-2 text-2xl font-black">Ajukan jadwal les private</h2>
        <p className="mt-2 text-[#52615b]">Usulkan slot mingguan; penyelenggara meninjau permintaan Anda sebelum enrollment dibuat. Kelas private tidak melalui checkout dari halaman ini.</p>
        {addStudentButton}
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
        {studentDialog}
      </section>
    );
  }

  if (classType === 'group' && !schedules.length && !restoredAttempt) return <section className="mt-10 rounded-3xl border border-[#f2c6c3] bg-white p-6" role="alert"><h2 className="text-xl font-black">Jadwal belum tersedia.</h2><p className="mt-2 text-[#52615b]">Kelas grup belum memiliki jadwal yang dapat dipilih. Coba lagi nanti atau hubungi penyelenggara.</p></section>;

  const availableSchedules = schedules.filter((schedule) => schedule.available);
  const orderId = state.payment?.merchantOrderId;
  const statusHref = orderId && parseMerchantOrderId(orderId) ? `${PAYMENT_RETURN_PATH}?merchantOrderId=${encodeURIComponent(orderId)}` : null;
  // KEL-194: when the echoed submission refers to a student or schedule that
  // is no longer offered, keep it visible as a disabled selected option so
  // the parent sees what was retried, alongside the backend's explicit error
  // message asking for a new choice.
  const echoedStudentMissing = Boolean(!state.success && restoredValues?.student_id && !studentOptions.some((student) => student.id === restoredValues?.student_id));
  const echoedScheduleMissing = Boolean(!state.success && restoredValues?.schedule_id && !schedules.some((schedule) => schedule.id === restoredValues?.schedule_id));
  return (
    <section className="mt-10 rounded-3xl border border-[#dfe3d7] bg-[#eef3dd] p-6 sm:p-8">
      <p className="text-sm font-bold uppercase tracking-[.14em] text-[#617c35]">Enrollment parent</p>
      <h2 className="mt-2 text-2xl font-black">Pilih student dan jadwal</h2>
      <p className="mt-2 text-[#52615b]">Harga dan status pembayaran ditentukan oleh backend setelah enrollment tervalidasi.</p>
      {/* KEL-194: dispatch via onSubmit instead of the `action` prop.
          React 19 resets the form DOM (native form.reset()) after every
          `action`-prop submission, which would put the controlled
          selects/radios back to their mount defaults (empty/monthly/VC)
          behind React's back. Calling the useActionState dispatch directly
          skips that reset, so the DOM stays in sync with the echoed picks.
          Native `required` validation still runs before onSubmit fires. */}
      <form onSubmit={(event) => {
        event.preventDefault();
        const submitted = new FormData(event.currentTarget);
        if (storageKey) setStorageWarning(!saveCheckoutAttempt(storageKey, submitted));
        startTransition(() => {
          formAction(submitted);
        });
      }} className="mt-6 space-y-5">
        {state.message && <div role={state.success ? 'status' : 'alert'} className={`rounded-2xl p-3 text-sm font-medium ${state.success ? 'bg-[#e8f3df] text-[#31551d]' : 'bg-[#fde8e7] text-[#8e2119]'}`}><p>{state.message}</p>{state.link && <Link className="mt-2 inline-block font-bold underline" href={state.link.href}>{state.link.label}</Link>}</div>}
        <div><label htmlFor="enrollment-student" className="text-sm font-bold">Student</label><select id="enrollment-student" name="student_id" value={shownStudentId} onChange={(event) => { setSelectedStudentId(event.target.value); markEditedAfterFailure('student_id'); if (restoredAttempt && event.target.value !== restoredAttempt.values.student_id) setCheckoutKey(crypto.randomUUID()); }} required className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3"><option value="">Pilih student</option>{echoedStudentMissing && <option value={restoredValues?.student_id} disabled>Pilihan sebelumnya tidak tersedia — pilih student baru</option>}{studentOptions.map((student) => <option value={student.id} key={student.id}>{student.first_name}{studentLastName(student) ? ` ${studentLastName(student)}` : ''}{student.nickname ? ` (${student.nickname})` : ''}</option>)}</select><FieldError errors={state.errors} name="student_id" /></div>
        {addStudentButton}
        <div><label htmlFor="enrollment-schedule" className="text-sm font-bold">Jadwal</label><select id="enrollment-schedule" name="schedule_id" value={shownScheduleId} onChange={(event) => { setSelectedScheduleId(event.target.value); markEditedAfterFailure('schedule_id'); }} required={schedules.length > 0} disabled={!availableSchedules.length && !recoveringAttempt} className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3"><option value="">{availableSchedules.length ? 'Pilih jadwal' : 'Tidak ada jadwal yang tersedia'}</option>{echoedScheduleMissing && <option value={restoredValues?.schedule_id} disabled={!recoveringAttempt}>Pilihan sebelumnya tidak tersedia — pilih jadwal baru</option>}{schedules.map((schedule) => <option value={schedule.id} key={schedule.id} disabled={!schedule.available && !(recoveringAttempt && schedule.id === shownScheduleId)}>{schedule.label}{schedule.available ? (schedule.availableSlots !== undefined ? ` · ${schedule.availableSlots} slot` : '') : ' · penuh'}</option>)}</select>{!availableSchedules.length && schedules.length > 0 && <p className="mt-1 text-sm text-[#8e2119]">{recoveringAttempt ? 'Jadwal sudah penuh. Percobaan sebelumnya tetap dapat diperiksa tanpa membuat pendaftaran baru.' : 'Semua jadwal sedang penuh. Coba lagi setelah ada slot tersedia.'}</p>}<FieldError errors={state.errors} name="schedule_id" /></div>
        <div><label htmlFor="enrollment-cycle" className="text-sm font-bold">Periode pembayaran</label><select id="enrollment-cycle" name="billing_cycle" value={shownCycle} onChange={(event) => { setSelectedCycle(event.target.value); markEditedAfterFailure('billing_cycle'); }} required className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3"><option value="monthly">Bulanan</option><option value="quarterly">Per tiga bulan</option><option value="yearly">Tahunan</option></select><FieldError errors={state.errors} name="billing_cycle" /></div>
        <fieldset className="rounded-2xl border border-[#c8d0c5] bg-white p-4">
          <legend className="px-1 text-sm font-bold">Metode pembayaran</legend>
          <div className="mt-2 space-y-2">
            {groupPaymentOptions.map((option) => (
              <label key={option.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-[#f4f8ec]">
                <input type="radio" name="payment_method" value={option.value} checked={shownMethod === option.value} onChange={(event) => { setSelectedMethod(event.target.value); markEditedAfterFailure('payment_method'); }} required className="mt-1 h-5 w-5 accent-[#617c35]" />
                <span><span className="block font-bold">{option.label}</span><span className="block text-sm text-[#52615b]">{option.hint}</span></span>
              </label>
            ))}
          </div>
          <FieldError errors={state.errors} name="payment_method" />
        </fieldset>
        <div>
          <label htmlFor="enrollment-voucher" className="text-sm font-bold">Kode voucher (opsional)</label>
          <input id="enrollment-voucher" name="voucher_code" value={shownVoucher} maxLength={100} onChange={(event) => {
            setVoucherCode(event.target.value);
            markEditedAfterFailure('voucher_code');
            ++previewVersion.current;
            setPreview(null);
            setCheckoutKey(crypto.randomUUID());
          }} className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3" />
          <FieldError errors={state.errors} name="voucher_code" />
          <button type="button" disabled={previewPending || !voucherCode.trim()} onClick={checkVoucher} className="mt-2 min-h-11 rounded-xl border border-[#617c35] px-4 font-bold disabled:opacity-50">{previewPending ? 'Memeriksa voucher…' : 'Periksa voucher'}</button>
          {preview && <div role={preview.success ? 'status' : 'alert'} className="mt-2 text-sm">
            <p>{preview.message}</p>
            {preview.data && <dl><dt>Diskon voucher</dt><dd>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(preview.data.discount_amount)}</dd><dt>Total preview</dt><dd>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(preview.data.gross_amount)}</dd></dl>}
          </div>}
          <p className="mt-2 text-sm text-[#52615b]">Preview bukan jaminan kuota. Total akhir ditentukan server saat checkout; perubahan voucher tidak mengubah invoice sebelumnya.</p>
        </div>
        <input type="hidden" name="idempotency_key" value={effectiveCheckoutKey} />
        <p className="text-sm text-[#52615b]">Jika provider belum merespons, kirim ulang form ini untuk melanjutkan intent yang sama.</p>
        <SubmitButton pending={checkoutPending} disabled={!availableSchedules.length && !recoveringAttempt} />
      </form>
      {storageWarning && <p role="alert" className="mt-3 text-sm text-[#8e2119]">Browser tidak dapat menyimpan percobaan pembayaran. Jangan muat ulang atau tutup tab sebelum hasil terkonfirmasi; coba lagi dari form yang sama.</p>}
      {restoredAttempt && <p className="mt-3 text-sm text-[#52615b]">Percobaan pembayaran sebelumnya dipulihkan di tab ini. Kirim ulang pilihan yang sama untuk mengambil pembayaran yang sudah tersimpan.</p>}
      {studentDialog}
      {state.success && state.payment && <div className="mt-6"><PaymentInstructionsPanel
        instructions={state.payment.instructions}
        channel={state.payment.channel}
        merchantOrderId={state.payment.merchantOrderId}
        amount={state.payment.amount}
        currency={state.payment.currency}
        qrImage={state.payment.qrImage}
        expiresAt={state.payment.expiresAt}
        statusHref={statusHref}
      /></div>}
    </section>
  );
}
