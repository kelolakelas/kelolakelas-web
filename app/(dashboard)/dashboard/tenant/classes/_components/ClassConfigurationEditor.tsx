'use client';

import { useScheduleTeachers } from './useScheduleTeachers';
import { TeacherLoadStatus } from './TeacherLoadStatus';

import { useCallback, useId, useRef, useState } from 'react';
import {
  changeClassSchedule,
  deleteClassSchedule,
  readClassConfiguration,
} from '../_actions/classActions';
import {
  scheduleItemSchema,
  type Category,
  type ClassEntity,
  type ClassSchedule,
} from '../_lib/schema';
import {
  scheduleFieldClass,
  scheduleLabelClass,
  scheduleControlClass,
  scheduleDayControlClass,
  scheduleDayControlStyle,
  scheduleTimeGridClass,
} from './schedule-field-styles';
import { ScheduleTimeInput } from './ScheduleTimeInput';
import { ClassEditForm } from './ClassEditForm';
import { ScheduleForm } from './ScheduleForm';

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const dayNames = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function ScheduleVersionEditor({
  schedule,
  permissions,
  onOperation,
}: {
  schedule: ClassSchedule;
  permissions: readonly string[];
  onOperation: (message: string) => Promise<void>;
}) {
  const formId = useId();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [slot, setSlot] = useState({
    day_of_week: schedule.day_of_week,
    start_time: schedule.start_time.slice(0, 8),
    end_time: schedule.end_time.slice(0, 8),
    capacity: String(schedule.capacity ?? ''),
    location: schedule.location ?? '',
    tutor_id: schedule.tutor_id ?? '',
  });
  const [effective, setEffective] = useState(
    () =>
      [today(), schedule.valid_from?.slice(0, 10) ?? ''].sort().at(-1) ??
      today(),
  );
  const { read: teachers, loading: teachersLoading, retry: retryTeachers } = useScheduleTeachers();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const editable = permissions.includes('schedule:update');
  const historic = Boolean(
    schedule.valid_until && schedule.valid_until.slice(0, 10) < today(),
  );
  const act = async (removing = false) => {
    if (busy.current) return;
    const parsed = scheduleItemSchema.safeParse({
      ...slot,
      ...(slot.tutor_id ? {} : { tutor_id: undefined }),
    });
    if (!removing && !parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join('.'),
            issue.message,
          ]),
        ),
      );
      setFailed(true);
      setMessage(parsed.error.issues[0].message);
      return;
    }
    setFieldErrors({});
    busy.current = true;
    setPending(true);
    try {
      const result = removing
        ? await deleteClassSchedule(schedule.id)
        : await changeClassSchedule(schedule.id, parsed!.data!, effective);
      setMessage(result.message);
      setFailed(!result.success);
      await onOperation(result.message);
    } catch {
      setFailed(true);
      setMessage(
        'The operation could not be confirmed. Reload saved configuration before another change.',
      );
      await onOperation('The operation could not be confirmed.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
      <p className="text-sm font-semibold">
        {dayNames[schedule.day_of_week - 1]} {schedule.start_time.slice(0, 5)}–
        {schedule.end_time.slice(0, 5)}
      </p>
      <p className="text-xs">
        {schedule.valid_from?.slice(0, 10) ?? 'No start boundary'} —{' '}
        {schedule.valid_until?.slice(0, 10) ?? 'Ongoing'}
        {historic ? ' · History (read-only)' : ''}
      </p>
      {!historic && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act();
          }}
          className="space-y-3"
        >
          <fieldset
            disabled={pending || !editable}
            className="min-w-0 space-y-3 disabled:opacity-60"
          >
            <div className={scheduleTimeGridClass}>
              <label
                htmlFor={`${formId}-day_of_week`}
                className={scheduleFieldClass}
              >
                <span
                  id={`${formId}-day_of_week-label`}
                  className={scheduleLabelClass}
                >
                  Day of week
                </span>
                <select
                  id={`${formId}-day_of_week`}
                  aria-labelledby={`${formId}-day_of_week-label`}
                  aria-invalid={Boolean(fieldErrors.day_of_week)}
                  aria-describedby={
                    fieldErrors.day_of_week
                      ? `${formId}-day_of_week-error`
                      : undefined
                  }
                  aria-label="Day of week"
                  value={slot.day_of_week}
                  onChange={(event) =>
                    setSlot({
                      ...slot,
                      day_of_week: Number(event.target.value),
                    })
                  }
                  className={scheduleDayControlClass}
                  style={scheduleDayControlStyle}
                >
                  {dayNames.map((day, index) => (
                    <option key={day} value={index + 1}>
                      {day}
                    </option>
                  ))}
                </select>
                {fieldErrors.day_of_week && (
                  <span
                    id={`${formId}-day_of_week-error`}
                    className="block text-xs text-red-600 dark:text-red-400"
                  >
                    {fieldErrors.day_of_week}
                  </span>
                )}
              </label>
              <label
                htmlFor={`${formId}-start_time`}
                className={scheduleFieldClass}
              >
                <span
                  id={`${formId}-start_time-label`}
                  className={scheduleLabelClass}
                >
                  Start time
                </span>
                <ScheduleTimeInput
                  id={`${formId}-start_time`}
                  aria-labelledby={`${formId}-start_time-label`}
                  aria-invalid={Boolean(fieldErrors.start_time)}
                  aria-describedby={
                    fieldErrors.start_time
                      ? `${formId}-start_time-error`
                      : undefined
                  }
                  required
                  value={slot.start_time}
                  onValueChange={(value) =>
                    setSlot({ ...slot, start_time: value })
                  }
                  className={scheduleControlClass}
                />
                {fieldErrors.start_time && (
                  <span
                    id={`${formId}-start_time-error`}
                    className="block text-xs text-red-600 dark:text-red-400"
                  >
                    {fieldErrors.start_time}
                  </span>
                )}
              </label>
              <label
                htmlFor={`${formId}-end_time`}
                className={scheduleFieldClass}
              >
                <span
                  id={`${formId}-end_time-label`}
                  className={scheduleLabelClass}
                >
                  End time
                </span>
                <ScheduleTimeInput
                  id={`${formId}-end_time`}
                  aria-labelledby={`${formId}-end_time-label`}
                  aria-invalid={Boolean(fieldErrors.end_time)}
                  aria-describedby={
                    fieldErrors.end_time
                      ? `${formId}-end_time-error`
                      : undefined
                  }
                  required
                  value={slot.end_time}
                  onValueChange={(value) =>
                    setSlot({ ...slot, end_time: value })
                  }
                  className={scheduleControlClass}
                />
                {fieldErrors.end_time && (
                  <span
                    id={`${formId}-end_time-error`}
                    className="block text-xs text-red-600 dark:text-red-400"
                  >
                    {fieldErrors.end_time}
                  </span>
                )}
              </label>
            </div>
            <label
              htmlFor={`${formId}-capacity`}
              className={scheduleFieldClass}
            >
              <span
                id={`${formId}-capacity-label`}
                className={scheduleLabelClass}
              >
                Capacity
              </span>
              <input
                id={`${formId}-capacity`}
                aria-labelledby={`${formId}-capacity-label`}
                aria-invalid={Boolean(fieldErrors.capacity)}
                aria-describedby={
                  fieldErrors.capacity ? `${formId}-capacity-error` : undefined
                }
                type="number"
                min="1"
                step="1"
                required
                value={slot.capacity}
                onChange={(event) =>
                  setSlot({ ...slot, capacity: event.target.value })
                }
                className={scheduleControlClass}
              />
              {fieldErrors.capacity && (
                <span
                  id={`${formId}-capacity-error`}
                  className="block text-xs text-red-600 dark:text-red-400"
                >
                  {fieldErrors.capacity}
                </span>
              )}
            </label>
            <label
              htmlFor={`${formId}-location`}
              className={scheduleFieldClass}
            >
              <span
                id={`${formId}-location-label`}
                className={scheduleLabelClass}
              >
                Location
              </span>
              <input
                id={`${formId}-location`}
                aria-labelledby={`${formId}-location-label`}
                aria-invalid={Boolean(fieldErrors.location)}
                aria-describedby={
                  fieldErrors.location ? `${formId}-location-error` : undefined
                }
                maxLength={255}
                value={slot.location}
                onChange={(event) =>
                  setSlot({ ...slot, location: event.target.value })
                }
                className={scheduleControlClass}
              />
              {fieldErrors.location && (
                <span
                  id={`${formId}-location-error`}
                  className="block text-xs text-red-600 dark:text-red-400"
                >
                  {fieldErrors.location}
                </span>
              )}
            </label>
            <label
              htmlFor={`${formId}-tutor_id`}
              className={scheduleFieldClass}
            >
              <span
                id={`${formId}-tutor_id-label`}
                className={scheduleLabelClass}
              >
                Schedule Teacher
              </span>
              <select
                id={`${formId}-tutor_id`}
                aria-labelledby={`${formId}-tutor_id-label`}
                aria-invalid={Boolean(fieldErrors.tutor_id)}
                aria-describedby={
                  fieldErrors.tutor_id ? `${formId}-tutor_id-error` : undefined
                }
                disabled={teachers?.state !== 'ok'}
                value={slot.tutor_id}
                onChange={(event) =>
                  setSlot({ ...slot, tutor_id: event.target.value })
                }
                className={scheduleControlClass}
              >
                <option value="">Unassigned</option>
                {teachers?.state === 'ok' &&
                  teachers.teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                {slot.tutor_id &&
                  (teachers?.state !== 'ok' ||
                    !teachers.teachers.some(
                      (teacher) => teacher.id === slot.tutor_id,
                    )) && (
                    <option value={slot.tutor_id}>
                      Previously assigned Teacher
                    </option>
                  )}
              </select>
              {fieldErrors.tutor_id && (
                <span
                  id={`${formId}-tutor_id-error`}
                  className="block text-xs text-red-600 dark:text-red-400"
                >
                  {fieldErrors.tutor_id}
                </span>
              )}
            </label>
            <TeacherLoadStatus read={teachers} loading={teachersLoading} retry={retryTeachers} />
            {teachers?.state === 'ok' && slot.tutor_id && !teachers.teachers.some(teacher => teacher.id === slot.tutor_id) && <p role="alert">The assigned Teacher is no longer eligible. Choose an active Teacher when changing the assignment.</p>}

            <label className={scheduleFieldClass}>
              <span className={scheduleLabelClass}>Effective from</span>
              <input
                type="date"
                required
                min={[today(), schedule.valid_from?.slice(0, 10) ?? '']
                  .sort()
                  .at(-1)}
                max={schedule.valid_until?.slice(0, 10)}
                value={effective}
                onChange={(event) => setEffective(event.target.value)}
                className={scheduleControlClass}
              />
            </label>
            <p className="text-xs">
              Changes create a new schedule version. Existing attendance and
              sold prices remain. Capacity must cover reserved seats.
            </p>
            {editable && (
              <button
                disabled={pending}
                className="min-h-[44px] rounded bg-blue-600 px-3 text-sm text-white"
              >
                {pending ? 'Saving…' : 'Save Schedule Change'}
              </button>
            )}
          </fieldset>
        </form>
      )}
      {!historic && permissions.includes('schedule:delete') && (
        <div className="space-y-2">
          {confirm ? (
            <>
              <p>
                Delete this schedule? A schedule with reserved enrollments
                cannot be deleted.
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => void act(true)}
                className="min-h-[44px] rounded border border-red-400 px-3 text-red-700"
              >
                Confirm Delete Schedule
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirm(false)}
                className="min-h-[44px] px-3"
              >
                Cancel Delete
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="min-h-[44px] text-sm text-red-700"
            >
              Delete Schedule
            </button>
          )}
        </div>
      )}
      {message && (
        <p role={failed ? 'alert' : 'status'} className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}

export function ClassConfigurationEditor({
  classRecord,
  categories,
  schedules,
  permissions,
}: {
  classRecord: ClassEntity;
  categories: Category[];
  schedules: ClassSchedule[];
  permissions: readonly string[];
}) {
  const [record, setRecord] = useState(classRecord);
  const [savedCategories, setCategories] = useState(categories);
  const [savedSchedules, setSchedules] = useState(
    schedules.filter((item) => item.class_id === classRecord.id),
  );
  const [message, setMessage] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [classVersion, setClassVersion] = useState(0);
  const [addVersion, setAddVersion] = useState(0);
  const addDetails = useRef<HTMLDetailsElement>(null);
  const reload = useCallback(
    async (message: string, resetClass = false) => {
      setReloading(true);
      setMessage(message);
      try {
        const result = await readClassConfiguration(classRecord.id);
        if (result.success && result.data) {
          setRecord(result.data.class);
          setCategories(result.data.categories);
          setSchedules(result.data.schedules);
          setBlocked(false);
          if (resetClass) setClassVersion((version) => version + 1);
        } else {
          setBlocked(true);
          setMessage(`${message} ${result.message}`);
        }
      } catch {
        setBlocked(true);
        setMessage(
          `${message} Saved configuration is unavailable. Reload before another change.`,
        );
      } finally {
        setReloading(false);
      }
    },
    [classRecord.id],
  );
  const classSettled = useCallback(
    (success: boolean) => {
      void reload(
        success
          ? 'Class details saved.'
          : 'Class save was not confirmed; checking saved details.',
        success,
      );
    },
    [reload],
  );
  const schedulesSaved = useCallback(() => {
    void reload('New schedules saved.').then(() => {
      setAddVersion((version) => version + 1);
      if (addDetails.current) addDetails.current.open = false;
    });
  }, [reload]);
  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-blue-50 p-3 text-sm dark:bg-blue-950">
        Save class details and each schedule separately. Each result below
        identifies what was saved; a failed operation does not undo previous
        saves.
      </p>
      <p className="text-sm">
        Saved class: <strong>{record.name}</strong> · {record.type} ·{' '}
        {record.price} IDR · {record.enrollment_status ?? 'open'}
      </p>
      {message && (
        <p
          role={blocked ? 'alert' : 'status'}
          className="rounded border p-3 text-sm"
        >
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={reloading}
        onClick={() => void reload('Reloading saved configuration.')}
        className="min-h-[44px] rounded border px-3 text-sm"
      >
        {reloading ? 'Reloading…' : 'Reload Saved Configuration'}
      </button>
      <fieldset
        disabled={blocked || reloading}
        className="min-w-0 space-y-6 disabled:opacity-60"
      >
        <fieldset
          disabled={!permissions.includes('class:update')}
          className="min-w-0 disabled:opacity-60"
        >
          <ClassEditForm
            key={classVersion}
            classRecord={record}
            categories={savedCategories}
            canCreateCategory={permissions.includes('category:create')}
            onSettled={classSettled}
          />
        </fieldset>
        {record.type === 'group' ? (
          <section className="space-y-4">
            <h3 className="font-semibold">Group Schedules</h3>
            {savedSchedules.length === 0 && <p>No schedules configured yet.</p>}
            {savedSchedules.map((schedule) => (
              <ScheduleVersionEditor
                key={schedule.id}
                schedule={schedule}
                permissions={permissions}
                onOperation={reload}
              />
            ))}
            {permissions.includes('schedule:create') && (
              <details ref={addDetails} className="rounded-xl border p-3">
                <summary className="min-h-[44px] cursor-pointer font-semibold">
                  Add Group Schedules
                </summary>
                <ScheduleForm
                  key={addVersion}
                  createdClass={record}
                  onScheduleSuccess={schedulesSaved}
                  onBack={() => {
                    if (addDetails.current) addDetails.current.open = false;
                  }}
                />
              </details>
            )}
          </section>
        ) : (
          <p>
            Private schedules are managed from each enrollment. Group schedule
            controls are unavailable for this class.
          </p>
        )}
      </fieldset>
    </div>
  );
}
