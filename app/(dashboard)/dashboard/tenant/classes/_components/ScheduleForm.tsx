'use client';

import { useScheduleTeachers } from './useScheduleTeachers';
import { TeacherLoadStatus } from './TeacherLoadStatus';

import { useActionState, useEffect, useId, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createSchedule,
  type ActionResponse,
} from '../_actions/classActions';
import {
  scheduleFieldClass,
  scheduleLabelClass,
  scheduleControlClass,
  scheduleDayControlClass,
  scheduleDayControlStyle,
  scheduleTimeGridClass,
} from './schedule-field-styles';
import { ScheduleTimeInput } from './ScheduleTimeInput';
import {
  findOverlappingSlotPairs,
  generateWeeklySlots,
  weeklySlotGeneratorSchema,
  createScheduleSchema,
  type ClassEntity,
  type ScheduleItemInput,
} from '../_lib/schema';

/**
 * A slot as the form holds it while the tenant is typing.
 *
 * Capacity stays the raw string the number input carries so a half-typed or
 * cleared value is never rewritten into a fake number (`Number('')` is 0, and
 * a 0 capacity would silently travel in the hidden payload). The zod schema
 * coerces and validates the string inside the Server Action, and the input's
 * `required`/`min`/`step` attributes stop an invalid form from being submitted
 * in the first place.
 */
type ScheduleSlotDraft = Omit<ScheduleItemInput, 'capacity'> & {
  capacity: string;
};

function SubmitScheduleButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Finalizing Schedules...
        </span>
      ) : (
        'Save Schedules ✓'
      )}
    </button>
  );
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
  { id: 7, label: 'Sunday' },
];

interface ScheduleFormProps {
  createdClass: ClassEntity;
  onDraftSubmit?: (slots: ScheduleItemInput[]) => void;
  pending?: boolean;
  onScheduleSuccess: () => void;
  onBack: () => void;
}

const initialActionState: ActionResponse = {
  success: false,
  message: '',
};

export function ScheduleForm({
  createdClass,
  onScheduleSuccess,
  onBack,
  onDraftSubmit,
  pending = false,
}: ScheduleFormProps) {
  const formId = useId();
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [draftError, setDraftError] = useState('');
  const [schedules, setSchedules] = useState<ScheduleSlotDraft[]>(() => onDraftSubmit ? [] : [
    {
      day_of_week: 1,
      start_time: '09:00',
      end_time: '10:30',
      capacity: '10',
      location: 'Room 101',
    },
  ]);

  const { read: teacherRead, loading: teachersLoading, retry: retryTeachers } = useScheduleTeachers();
  const [tutorId, setTutorId] = useState('');

  const [state, formAction] = useActionState(
    createSchedule,
    initialActionState,
  );

  useEffect(() => {
    if (state.success) {
      onScheduleSuccess();
    }
  }, [state, onScheduleSuccess]);

  /**
   * Weekly slot generator drafts (KEL-112).
   *
   * The generator fields stay raw strings so a half-typed or cleared value is
   * never rewritten into a fake number. Validation runs through
   * `weeklySlotGeneratorSchema` on generate, and each failure surfaces as a
   * per-field message without producing any slot.
   */
  const [generatorDays, setGeneratorDays] = useState<number[]>([1, 2]);
  const [generatorStart, setGeneratorStart] = useState('08:00');
  const [generatorEnd, setGeneratorEnd] = useState('12:00');
  const [generatorSessionMinutes, setGeneratorSessionMinutes] = useState('90');
  const [generatorBreakMinutes, setGeneratorBreakMinutes] = useState('15');
  const [generatorCapacity, setGeneratorCapacity] = useState('10');
  const [generatorLocation, setGeneratorLocation] = useState('');
  const [generatorErrors, setGeneratorErrors] = useState<
    Record<string, string>
  >({});
  const [generatorNotice, setGeneratorNotice] = useState<string | null>(null);

  const toggleGeneratorDay = (day: number) => {
    setGeneratorDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const isDuplicateSlot = (
    existing: ScheduleSlotDraft[],
    day: number,
    start: string,
    end: string,
  ) =>
    existing.some(
      (slot) =>
        slot.day_of_week === day &&
        slot.start_time === start &&
        slot.end_time === end,
    );

  const handleGenerateSlots = () => {
    const validation = weeklySlotGeneratorSchema.safeParse({
      days: generatorDays,
      start_time: generatorStart,
      end_time: generatorEnd,
      session_minutes: generatorSessionMinutes,
      break_minutes: generatorBreakMinutes,
      capacity: generatorCapacity,
      location: generatorLocation,
    });

    if (!validation.success) {
      const fieldErrors = validation.error.flatten().fieldErrors;
      const errors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(fieldErrors)) {
        if (messages?.[0]) {
          errors[field] = messages[0];
        }
      }
      setGeneratorErrors(errors);
      setGeneratorNotice(null);
      return;
    }

    setGeneratorErrors({});
    const generated = generateWeeklySlots(validation.data);

    if (generated.length === 0) {
      // Valid input whose window fits no whole session: nothing to append,
      // reported as a form-level message so the tenant can adjust the range.
      setGeneratorNotice(
        'No session fits the selected time range. Adjust the hours, session length, or break.',
      );
      return;
    }

    const fresh = generated.filter(
      (slot) =>
        !isDuplicateSlot(
          schedules,
          slot.day_of_week,
          slot.start_time,
          slot.end_time,
        ),
    );

    if (fresh.length === 0) {
      setGeneratorNotice(
        'All generated slots already exist. No duplicate slots were added.',
      );
      return;
    }

    setGeneratorNotice(
      `Added ${fresh.length} slot${fresh.length === 1 ? '' : 's'}${
        fresh.length < generated.length
          ? ` (${generated.length - fresh.length} duplicate${generated.length - fresh.length === 1 ? '' : 's'} skipped)`
          : ''
      }.`,
    );
    setSchedules([
      ...schedules,
      ...fresh.map((slot) => ({
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        capacity: String(slot.capacity),
        location: slot.location ?? '',
        ...(tutorId ? { tutor_id: tutorId } : {}),
      })),
    ]);
  };

  const addScheduleSlot = () => {
    setSchedules((prev) => [
      ...prev,
      {
        ...(tutorId ? { tutor_id: tutorId } : {}),
        day_of_week: 3, // default Wednesday
        start_time: '14:00',
        end_time: '15:30',
        capacity: '10',
        location: '',
      },
    ]);
  };

  const removeScheduleSlot = (index: number) => {
    if (!onDraftSubmit && schedules.length <= 1) return;
    setSchedules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateScheduleSlot = <K extends keyof ScheduleSlotDraft>(
    index: number,
    field: K,
    value: ScheduleSlotDraft[K],
  ) => {
    if (field === 'tutor_id' && value !== tutorId) setTutorId('');
    setSchedules((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  /**
   * Same-day overlap warnings (KEL-176).
   *
   * Recomputed from the editable drafts on every render, so an overlap warns
   * as soon as it is typed, generated, or edited in, and disappears as soon
   * as one side is moved or removed. This is advisory only: generation,
   * duplicate prevention, and the hidden submission payload are unchanged,
   * and the warning never blocks saving.
   */
  const overlappingPairs = useMemo(
    () => findOverlappingSlotPairs(schedules),
    [schedules],
  );

  const overlapBySlot = useMemo(() => {
    const bySlot = new Map<number, number[]>();
    for (const pair of overlappingPairs) {
      const first = bySlot.get(pair.first) ?? [];
      first.push(pair.second);
      bySlot.set(pair.first, first);
      const second = bySlot.get(pair.second) ?? [];
      second.push(pair.first);
      bySlot.set(pair.second, second);
    }
    return bySlot;
  }, [overlappingPairs]);

  const draftValidation = createScheduleSchema.safeParse({
    class_id: createdClass.id,
    schedules,
  });
  const draftTeachersValid = teacherRead?.state === 'ok' &&
    schedules.every((slot) => Boolean(slot.tutor_id) &&
      teacherRead.teachers.some((teacher) => teacher.id === slot.tutor_id));
  const canSaveDraft = draftValidation.success && draftTeachersValid;

  const slotError = (index: number, field: string) =>
    draftErrors[`schedules.${index}.${field}`] ||
    state.errors?.[`schedules.${index}.${field}`]?.[0] ||
    state.errors?.schedules?.[0];

  return (
    <form
      action={formAction}
      onSubmit={
        onDraftSubmit
          ? (event) => {
              event.preventDefault();
              if (schedules.some((slot) =>
                !slot.tutor_id || teacherRead?.state !== 'ok' ||
                !teacherRead.teachers.some((teacher) => teacher.id === slot.tutor_id)
              )) {
                setDraftError('Select an active Teacher for every slot.');
                setDraftErrors(Object.fromEntries(schedules.flatMap((slot, index) =>
                  !slot.tutor_id || teacherRead?.state !== 'ok' || !teacherRead.teachers.some((teacher) => teacher.id === slot.tutor_id)
                    ? [[`schedules.${index}.tutor_id`, 'Select an active Teacher for this slot.']] : []
                )));
                return;
              }
              const parsed = draftValidation;
              if (parsed.success) {
                setDraftError('');
                setDraftErrors({});
                onDraftSubmit(parsed.data.schedules);
              } else {
                setDraftErrors(
                  Object.fromEntries(
                    parsed.error.issues.map((issue) => [
                      issue.path.join('.'),
                      issue.message,
                    ]),
                  ),
                );
                setDraftError(
                  parsed.error.issues[0]?.message ||
                    'Check the schedule slots.',
                );
              }
            }
          : undefined
      }
      className="min-w-0 space-y-5"
    >
      {/* Created Class Details Header */}
      <div className="flex min-w-0 items-center justify-between break-words rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-4 py-3 text-xs">
        <div>
          <span className="text-gray-500 dark:text-gray-400 block">
            Class Configured:
          </span>
          <span className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
            {createdClass.name}
          </span>
          <span className="ml-2 inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-200">
            {createdClass.type}
          </span>
        </div>
      </div>

      <input type="hidden" name="class_id" value={createdClass.id} />
      <input
        type="hidden"
        name="schedules"
        value={JSON.stringify(
          schedules.map((slot) => ({
            ...slot,
            capacity: Number(slot.capacity),
          })),
        )}
      />

      <div className="space-y-2">
        <label
          htmlFor={`${formId}-teacher`}
          className="block text-sm font-semibold"
        >
          Teacher for all slots
        </label>
        <select
          id={`${formId}-teacher`}
          aria-describedby={`${formId}-teacher-help`}
          value={tutorId}
          onChange={(event) => {
            const value = event.target.value;
            setTutorId(value);
            setSchedules((previous) => previous.map((slot) => ({...slot, tutor_id: value || undefined})));
          }}
          disabled={
            teacherRead?.state !== 'ok' || teacherRead.teachers.length === 0
          }
          className={scheduleControlClass}
        >
          <option value="">Unassigned</option>
          {teacherRead?.state === 'ok' &&
            teacherRead.teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
        </select>
        <TeacherLoadStatus id={`${formId}-teacher-help`} read={teacherRead} loading={teachersLoading} retry={retryTeachers} readyMessage="The selected Teacher applies to every manual and generated slot." />
        {teacherRead?.state === 'ok' && schedules.some(slot => slot.tutor_id && !teacherRead.teachers.some(teacher => teacher.id === slot.tutor_id)) && <p role="alert">A selected Teacher is no longer eligible. Choose an active Teacher for that slot.</p>}
        {!onDraftSubmit && schedules.some((slot) => !slot.tutor_id) && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            These schedules will be unassigned and will not appear in any
            Teacher’s Sesi Saya.
          </p>
        )}
      </div>

      {draftError && (
        <p role="alert" className="text-sm text-red-700">
          {draftError}
        </p>
      )}
      {/* Global Error Notice */}
      {!state.success && state.message && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300">
          {state.message}
        </div>
      )}

      {/* Weekly Slot Generator (KEL-112) */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Weekly Slot Generator
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Pick days and a time window, then generate weekly sessions to review
            below. Generated slots are added to the list and stay editable.
          </p>
        </div>

        {/* Days */}
        <fieldset
          className={scheduleFieldClass}
          aria-describedby={
            generatorErrors.days ? `${formId}-generator-days-error` : undefined
          }
        >
          <legend className={scheduleLabelClass}>Days</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <label
                key={day.id}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200"
              >
                <input
                  type="checkbox"
                  checked={generatorDays.includes(day.id)}
                  onChange={() => toggleGeneratorDay(day.id)}
                  aria-label={`Generate on ${day.label}`}
                  aria-invalid={Boolean(generatorErrors.days)}
                  aria-describedby={
                    generatorErrors.days
                      ? `${formId}-generator-days-error`
                      : undefined
                  }
                  className="h-4 w-4 rounded accent-blue-600"
                />
                {day.label}
              </label>
            ))}
          </div>
          {generatorErrors.days && (
            <p
              id={`${formId}-generator-days-error`}
              className="text-xs text-red-600 dark:text-red-400"
            >
              {generatorErrors.days}
            </p>
          )}
        </fieldset>

        {/* Time window */}
        <div className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2">
          <div className={scheduleFieldClass}>
            <label
              htmlFor={`${formId}-generator-start_time`}
              className={scheduleLabelClass}
            >
              Start Time
            </label>
            <ScheduleTimeInput
              id={`${formId}-generator-start_time`}
              aria-invalid={Boolean(generatorErrors.start_time)}
              aria-describedby={
                generatorErrors.start_time
                  ? `${formId}-generator-start_time-error`
                  : undefined
              }
              value={generatorStart}
              onValueChange={setGeneratorStart}
              aria-label="Generator start time"
              className={scheduleControlClass}
            />
            {generatorErrors.start_time && (
              <p
                id={`${formId}-generator-start_time-error`}
                className="text-xs text-red-600 dark:text-red-400"
              >
                {generatorErrors.start_time}
              </p>
            )}
          </div>
          <div className={scheduleFieldClass}>
            <label
              htmlFor={`${formId}-generator-end_time`}
              className={scheduleLabelClass}
            >
              End Time
            </label>
            <ScheduleTimeInput
              id={`${formId}-generator-end_time`}
              aria-invalid={Boolean(generatorErrors.end_time)}
              aria-describedby={
                generatorErrors.end_time
                  ? `${formId}-generator-end_time-error`
                  : undefined
              }
              value={generatorEnd}
              onValueChange={setGeneratorEnd}
              aria-label="Generator end time"
              className={scheduleControlClass}
            />
            {generatorErrors.end_time && (
              <p
                id={`${formId}-generator-end_time-error`}
                className="text-xs text-red-600 dark:text-red-400"
              >
                {generatorErrors.end_time}
              </p>
            )}
          </div>
        </div>

        {/* Session / break */}
        <div className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2">
          <div className={scheduleFieldClass}>
            <label
              htmlFor={`${formId}-generator-session_minutes`}
              className={scheduleLabelClass}
            >
              Session Length (minutes)
            </label>
            <input
              id={`${formId}-generator-session_minutes`}
              aria-invalid={Boolean(generatorErrors.session_minutes)}
              aria-describedby={
                generatorErrors.session_minutes
                  ? `${formId}-generator-session_minutes-error`
                  : undefined
              }
              type="number"
              min="1"
              step="1"
              value={generatorSessionMinutes}
              onChange={(e) => setGeneratorSessionMinutes(e.target.value)}
              aria-label="Generator session length in minutes"
              className={scheduleControlClass}
            />
            {generatorErrors.session_minutes && (
              <p
                id={`${formId}-generator-session_minutes-error`}
                className="text-xs text-red-600 dark:text-red-400"
              >
                {generatorErrors.session_minutes}
              </p>
            )}
          </div>
          <div className={scheduleFieldClass}>
            <label
              htmlFor={`${formId}-generator-break_minutes`}
              className={scheduleLabelClass}
            >
              Break Between Sessions (minutes)
            </label>
            <input
              id={`${formId}-generator-break_minutes`}
              aria-invalid={Boolean(generatorErrors.break_minutes)}
              aria-describedby={
                generatorErrors.break_minutes
                  ? `${formId}-generator-break_minutes-error`
                  : undefined
              }
              type="number"
              min="0"
              step="1"
              value={generatorBreakMinutes}
              onChange={(e) => setGeneratorBreakMinutes(e.target.value)}
              aria-label="Generator break in minutes"
              className={scheduleControlClass}
            />
            {generatorErrors.break_minutes && (
              <p
                id={`${formId}-generator-break_minutes-error`}
                className="text-xs text-red-600 dark:text-red-400"
              >
                {generatorErrors.break_minutes}
              </p>
            )}
          </div>
        </div>

        {/* Defaults */}
        <div className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2">
          <div className={scheduleFieldClass}>
            <label
              htmlFor={`${formId}-generator-capacity`}
              className={scheduleLabelClass}
            >
              Default Capacity
            </label>
            <input
              id={`${formId}-generator-capacity`}
              aria-invalid={Boolean(generatorErrors.capacity)}
              aria-describedby={
                generatorErrors.capacity
                  ? `${formId}-generator-capacity-error`
                  : undefined
              }
              type="number"
              min="1"
              step="1"
              value={generatorCapacity}
              onChange={(e) => setGeneratorCapacity(e.target.value)}
              aria-label="Generator default capacity"
              className={scheduleControlClass}
            />
            {generatorErrors.capacity && (
              <p
                id={`${formId}-generator-capacity-error`}
                className="text-xs text-red-600 dark:text-red-400"
              >
                {generatorErrors.capacity}
              </p>
            )}
          </div>
          <div className={scheduleFieldClass}>
            <label
              htmlFor={`${formId}-generator-location`}
              className={scheduleLabelClass}
            >
              Default Location
            </label>
            <input
              id={`${formId}-generator-location`}
              aria-invalid={Boolean(generatorErrors.location)}
              aria-describedby={
                generatorErrors.location
                  ? `${formId}-generator-location-error`
                  : undefined
              }
              type="text"
              placeholder="Room 102 or Online Zoom Link (optional)"
              value={generatorLocation}
              onChange={(e) => setGeneratorLocation(e.target.value)}
              aria-label="Generator default location"
              className={scheduleControlClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleGenerateSlots}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            Generate Slots
          </button>
          {generatorNotice && (
            <p
              role="status"
              className="text-xs text-gray-600 dark:text-gray-300"
            >
              {generatorNotice}
            </p>
          )}
        </div>
      </div>

      {/* Recurring Schedule Slot Cards */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Weekly Recurring Timetable
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Add all recurring weekly sessions for this class.
            </p>
          </div>
          <button
            type="button"
            onClick={addScheduleSlot}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Slot
          </button>
        </div>

        <div className="space-y-3">
          {schedules.length === 0 && (
            <p
              role="status"
              className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300"
            >
              No timetable slots yet. Add a slot or use Generate Slots to build your timetable.
            </p>
          )}
          {schedules.map((slot, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/80 p-4 shadow-xs space-y-3 relative"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/60 pb-2">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Slot #{idx + 1}
                </span>
                {(schedules.length > 1 || onDraftSubmit) && (
                  <button
                    type="button"
                    onClick={() => removeScheduleSlot(idx)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                    aria-label={`Remove slot ${idx + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className={scheduleFieldClass}>
                <label htmlFor={`${formId}-slot-${idx}-teacher`} className={scheduleLabelClass}>
                  Teacher for slot {idx + 1}
                </label>
                <select
                  id={`${formId}-slot-${idx}-teacher`}
                  value={slot.tutor_id ?? ''}
                  required={Boolean(onDraftSubmit)}
                  disabled={teacherRead?.state !== 'ok'}
                  aria-invalid={Boolean(slotError(idx, 'tutor_id'))}
                  aria-describedby={slotError(idx, 'tutor_id') ? `${formId}-slot-${idx}-teacher-error` : undefined}
                  onChange={(event) => updateScheduleSlot(idx, 'tutor_id', event.target.value || undefined)}
                  className={scheduleControlClass}
                >
                  <option value="">Select an active Teacher</option>
                  {teacherRead?.state === 'ok' && teacherRead.teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
                {slotError(idx, 'tutor_id') && <p id={`${formId}-slot-${idx}-teacher-error`} className="text-xs text-red-600 dark:text-red-400">{slotError(idx, 'tutor_id')}</p>}
              </div>

              <div className={scheduleTimeGridClass}>
                {/* Day Selection */}
                <div className={scheduleFieldClass}>
                  <label
                    htmlFor={`${formId}-slot-${idx}-day_of_week`}
                    className={scheduleLabelClass}
                  >
                    Day of Week
                  </label>
                  <select
                    id={`${formId}-slot-${idx}-day_of_week`}
                    aria-invalid={Boolean(slotError(idx, 'day_of_week'))}
                    aria-describedby={
                      slotError(idx, 'day_of_week')
                        ? `${formId}-slot-${idx}-day_of_week-error`
                        : undefined
                    }
                    value={slot.day_of_week}
                    onChange={(e) =>
                      updateScheduleSlot(
                        idx,
                        'day_of_week',
                        Number(e.target.value),
                      )
                    }
                    className={scheduleDayControlClass}
                    style={scheduleDayControlStyle}
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.id} value={day.id}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                  {slotError(idx, 'day_of_week') && (
                    <p
                      id={`${formId}-slot-${idx}-day_of_week-error`}
                      className="text-xs text-red-600 dark:text-red-400"
                    >
                      {slotError(idx, 'day_of_week')}
                    </p>
                  )}
                </div>

                {/* Start Time */}
                <div className={scheduleFieldClass}>
                  <label
                    htmlFor={`${formId}-slot-${idx}-start_time`}
                    className={scheduleLabelClass}
                  >
                    Start Time
                  </label>
                  <ScheduleTimeInput
                    id={`${formId}-slot-${idx}-start_time`}
                    aria-invalid={Boolean(slotError(idx, 'start_time'))}
                    aria-describedby={
                      slotError(idx, 'start_time')
                        ? `${formId}-slot-${idx}-start_time-error`
                        : undefined
                    }
                    value={slot.start_time}
                    onValueChange={(value) =>
                      updateScheduleSlot(idx, 'start_time', value)
                    }
                    required
                    className={scheduleControlClass}
                  />
                  {slotError(idx, 'start_time') && (
                    <p
                      id={`${formId}-slot-${idx}-start_time-error`}
                      className="text-xs text-red-600 dark:text-red-400"
                    >
                      {slotError(idx, 'start_time')}
                    </p>
                  )}
                </div>

                {/* End Time */}
                <div className={scheduleFieldClass}>
                  <label
                    htmlFor={`${formId}-slot-${idx}-end_time`}
                    className={scheduleLabelClass}
                  >
                    End Time
                  </label>
                  <ScheduleTimeInput
                    id={`${formId}-slot-${idx}-end_time`}
                    aria-invalid={Boolean(slotError(idx, 'end_time'))}
                    aria-describedby={
                      slotError(idx, 'end_time')
                        ? `${formId}-slot-${idx}-end_time-error`
                        : undefined
                    }
                    value={slot.end_time}
                    onValueChange={(value) =>
                      updateScheduleSlot(idx, 'end_time', value)
                    }
                    required
                    className={scheduleControlClass}
                  />
                  {slotError(idx, 'end_time') && (
                    <p
                      id={`${formId}-slot-${idx}-end_time-error`}
                      className="text-xs text-red-600 dark:text-red-400"
                    >
                      {slotError(idx, 'end_time')}
                    </p>
                  )}
                </div>
              </div>

              <div className={scheduleTimeGridClass}>
                {/* Capacity (required positive integer, validated by the schema) */}
                <div className={scheduleFieldClass}>
                  <label
                    htmlFor={`${formId}-slot-${idx}-capacity`}

                    className={scheduleLabelClass}
                  >
                    Capacity
                  </label>
                  <input
                    id={`${formId}-slot-${idx}-capacity`}
                    aria-invalid={Boolean(slotError(idx, 'capacity'))}
                    aria-describedby={
                      slotError(idx, 'capacity')
                        ? `${formId}-slot-${idx}-capacity-error`
                        : undefined
                    }

                    type="number"
                    min="1"
                    step="1"
                    value={slot.capacity}
                    onChange={(e) =>
                      updateScheduleSlot(idx, 'capacity', e.target.value)
                    }
                    required
                    aria-label={`Capacity for slot ${idx + 1}`}
                    className={scheduleControlClass}
                  />
                  {slotError(idx, 'capacity') && (
                    <p
                      id={`${formId}-slot-${idx}-capacity-error`}
                      className="text-xs text-red-600 dark:text-red-400"
                    >
                      {slotError(idx, 'capacity')}
                    </p>
                  )}
                </div>

                {/* Location optional input */}
                <div className="min-w-0 space-y-1 md:col-span-2">
                  <label
                    htmlFor={`${formId}-slot-${idx}-location`}
                    className={scheduleLabelClass}
                  >
                    Location
                  </label>
                  <input
                    id={`${formId}-slot-${idx}-location`}
                    aria-invalid={Boolean(slotError(idx, 'location'))}
                    aria-describedby={
                      slotError(idx, 'location')
                        ? `${formId}-slot-${idx}-location-error`
                        : undefined
                    }
                    type="text"
                    placeholder="Room 102 or Online Zoom Link (optional)"
                    value={slot.location || ''}
                    onChange={(e) =>
                      updateScheduleSlot(idx, 'location', e.target.value)
                    }
                    className={scheduleControlClass}
                  />
                  {slotError(idx, 'location') && (
                    <p
                      id={`${formId}-slot-${idx}-location-error`}
                      className="text-xs text-red-600 dark:text-red-400"
                    >
                      {slotError(idx, 'location')}
                    </p>
                  )}
                </div>
              </div>

              {overlapBySlot.has(idx) && (
                <p
                  role="alert"
                  className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
                >
                  Overlaps with slot{' '}
                  {(overlapBySlot.get(idx) ?? [])
                    .map((other) => `#${other + 1}`)
                    .join(', ')}
                  . Slots on the same day should not overlap.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {onDraftSubmit && schedules.length > 0 && !canSaveDraft && (
        <p
          id={`${formId}-draft-help`}
          role="status"
          className="text-sm text-amber-700 dark:text-amber-300"
        >
          Complete every slot with a valid time range, capacity and active Teacher before saving.
        </p>
      )}

      {/* Form Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          ← Back
        </button>
        {onDraftSubmit ? (
          <button
            type="submit"
            disabled={pending || !canSaveDraft}
            aria-describedby={
              schedules.length > 0 && !canSaveDraft
                ? `${formId}-draft-help` : undefined
            }
            className="min-h-[44px] rounded-xl bg-emerald-600 px-5 py-2 text-white disabled:opacity-50"
          >
            {pending ? 'Saving Class…' : 'Save Complete Class ✓'}
          </button>
        ) : (
          <SubmitScheduleButton />
        )}
      </div>
    </form>
  );
}
