'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createScheduleRequest } from '../_actions/actions';
import type { EnrollmentActionState } from '@/lib/enrollment';
import { WEEKDAY_NAMES } from '@/lib/enrollment-schedule';
import {
  validateScheduleSlotDrafts,
  type ScheduleRequest,
  type ScheduleSlotDraft,
} from '@/lib/schedule-request';
import { studentLastName, type Student } from '@/lib/students';

const initialState: EnrollmentActionState = { success: false, message: '' };

const BILLING_CYCLE_LABELS: Record<string, string> = {
  monthly: 'Bulanan',
  quarterly: 'Per tiga bulan',
  yearly: 'Tahunan',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 rounded-xl bg-[#17231f] px-5 font-bold text-white transition hover:bg-[#31463d] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Mengirim permintaan…' : 'Kirim permintaan jadwal'}
    </button>
  );
}

function FieldError({ errors, name }: { errors?: Record<string, string[]>; name: string }) {
  const message = errors?.[name]?.[0];
  return message ? <p className="mt-1 text-sm text-[#b42318]">{message}</p> : null;
}

/**
 * Private-class schedule request form (KEL-109).
 *
 * A parent proposes weekly slots instead of going through checkout, so this
 * form never shows "Lanjut ke pembayaran". Slots are added and removed
 * dynamically; a slot whose end is not after its start is rejected in the form
 * before any request is sent (client pre-check via
 * `validateScheduleSlotDrafts`, mirrored by the server-side schema).
 */
export function ScheduleRequestForm({
  classId,
  students,
  initialStudentId = '',
  resubmitFrom,
}: {
  classId: string;
  students: Student[];
  initialStudentId?: string;
  resubmitFrom?: ScheduleRequest;
}) {
  const [state, formAction] = useActionState(createScheduleRequest, initialState);
  const [selectedStudentId, setSelectedStudentId] = useState(resubmitFrom?.student_id || initialStudentId);
  const initialDrafts: ScheduleSlotDraft[] = resubmitFrom
    ? resubmitFrom.slots.map((slot) => ({
        day_of_week: String(slot.day_of_week),
        start_time: slot.start_time.slice(0, 5),
        end_time: slot.end_time.slice(0, 5),
      }))
    : [{ day_of_week: '1', start_time: '', end_time: '' }];
  const [drafts, setDrafts] = useState<ScheduleSlotDraft[]>(initialDrafts);
  const [clientError, setClientError] = useState<string | null>(null);

  const updateDraft = (index: number, patch: Partial<ScheduleSlotDraft>) => {
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  };

  const slotPayload = JSON.stringify(
    drafts.map((draft) => ({ day_of_week: Number(draft.day_of_week), start_time: draft.start_time, end_time: draft.end_time }))
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const error = validateScheduleSlotDrafts(drafts);
        if (error) {
          event.preventDefault();
          setClientError(error);
          return;
        }
        setClientError(null);
      }}
      className="mt-6 space-y-5"
    >
      {resubmitFrom && (
        <p role="status" className="rounded-2xl bg-[#eef3f1] p-3 text-sm font-medium text-[#365047]">
          Mengajukan ulang permintaan yang ditolak. Slot sebelumnya sudah diisi ulang — periksa kembali lalu kirim.
        </p>
      )}
      {state.message && (
        <div
          role={state.success ? 'status' : 'alert'}
          className={`rounded-2xl p-3 text-sm font-medium ${state.success ? 'bg-[#e8f3df] text-[#31551d]' : 'bg-[#fde8e7] text-[#8e2119]'}`}
        >
          <p>{state.message}</p>
          {state.link && (
            <Link className="mt-2 inline-block font-bold underline" href={state.link.href}>
              {state.link.label}
            </Link>
          )}
        </div>
      )}
      {clientError && (
        <p role="alert" className="rounded-2xl bg-[#fde8e7] p-3 text-sm font-medium text-[#8e2119]">
          {clientError}
        </p>
      )}

      <div>
        <label htmlFor="schedule-request-student" className="text-sm font-bold">
          Student
        </label>
        <select
          id="schedule-request-student"
          name="student_id"
          value={selectedStudentId}
          onChange={(event) => setSelectedStudentId(event.target.value)}
          required
          className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3"
        >
          <option value="">Pilih student</option>
          {students.map((student) => (
            <option value={student.id} key={student.id}>
              {student.first_name}
              {studentLastName(student) ? ` ${studentLastName(student)}` : ''}
              {student.nickname ? ` (${student.nickname})` : ''}
            </option>
          ))}
        </select>
        <FieldError errors={state.errors} name="student_id" />
      </div>

      <div>
        <label htmlFor="schedule-request-cycle" className="text-sm font-bold">
          Periode pembayaran
        </label>
        <select
          id="schedule-request-cycle"
          name="billing_cycle"
          defaultValue={resubmitFrom?.billing_cycle || 'monthly'}
          required
          className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3"
        >
          {Object.entries(BILLING_CYCLE_LABELS).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <FieldError errors={state.errors} name="billing_cycle" />
      </div>

      <fieldset>
        <legend className="text-sm font-bold">Slot jadwal yang diajukan</legend>
        <div className="mt-2 space-y-3">
          {drafts.map((draft, index) => (
            <div key={index} className="rounded-2xl border border-[#dfe3d7] bg-white p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor={`schedule-request-day-${index}`} className="text-sm font-bold">
                    Hari
                  </label>
                  <select
                    id={`schedule-request-day-${index}`}
                    value={draft.day_of_week}
                    onChange={(event) => updateDraft(index, { day_of_week: event.target.value })}
                    className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] bg-white px-3"
                  >
                    {WEEKDAY_NAMES.map((name, dayIndex) => (
                      <option value={String(dayIndex + 1)} key={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`schedule-request-start-${index}`} className="text-sm font-bold">
                    Jam mulai
                  </label>
                  <input
                    id={`schedule-request-start-${index}`}
                    type="time"
                    value={draft.start_time}
                    onChange={(event) => updateDraft(index, { start_time: event.target.value })}
                    required
                    className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] px-3"
                  />
                </div>
                <div>
                  <label htmlFor={`schedule-request-end-${index}`} className="text-sm font-bold">
                    Jam selesai
                  </label>
                  <input
                    id={`schedule-request-end-${index}`}
                    type="time"
                    value={draft.end_time}
                    onChange={(event) => updateDraft(index, { end_time: event.target.value })}
                    required
                    className="mt-1 min-h-11 w-full rounded-xl border border-[#c8d0c5] px-3"
                  />
                </div>
              </div>
              {drafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                  className="mt-3 text-sm font-bold text-[#b42318] hover:underline"
                >
                  Hapus slot ini
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDrafts((current) => [...current, { day_of_week: '1', start_time: '', end_time: '' }])}
          className="mt-3 min-h-11 rounded-xl border border-[#c8d0c5] bg-white px-4 text-sm font-bold text-[#31463d] hover:bg-[#f3f6ef]"
        >
          Tambah slot
        </button>
        <FieldError errors={state.errors} name="slots" />
        <p className="mt-1 text-sm text-[#52615b]">Jam selesai harus setelah jam mulai pada setiap slot.</p>
      </fieldset>

      <div>
        <label htmlFor="schedule-request-note" className="text-sm font-bold">
          Catatan untuk penyelenggara <span className="font-normal text-[#52615b]">(opsional)</span>
        </label>
        <textarea
          id="schedule-request-note"
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={resubmitFrom?.note || ''}
          placeholder="Contoh: lokasi les, kebutuhan khusus, atau rentang tanggal."
          className="mt-1 w-full rounded-xl border border-[#c8d0c5] bg-white px-3 py-2"
        />
        <FieldError errors={state.errors} name="note" />
      </div>

      <input type="hidden" name="slots" value={slotPayload} />
      <input type="hidden" name="class_id" value={classId} />
      <SubmitButton />
    </form>
  );
}
