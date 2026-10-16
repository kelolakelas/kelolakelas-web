'use client';

import { useEffect, useRef, useState } from 'react';
import type { Category, ClassEntity, ScheduleItemInput } from '../_lib/schema';
import type { ClassCreationInput } from '../_lib/class-creation';
import type { ScheduleTeachersRead } from '../_lib/teachers';
import {
  createClassConfiguration,
  getScheduleTeachers,
} from '../_actions/classActions';
import { CategoryForm } from './CategoryForm';
import { ClassForm } from './ClassForm';
import { ScheduleForm } from './ScheduleForm';

interface ClassCreationWizardProps {
  existingCategories: Category[];
  onComplete?: () => void;
}

export function PrivateClassScheduleNotice({
  className: name,
  onFinish,
}: {
  className: string;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-4 py-3 text-xs">
        <div>
          <span className="text-gray-500 dark:text-gray-400 block">
            Draft Class:
          </span>
          <span className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
            {name}
          </span>
          <span className="ml-2 inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-200">
            private
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-4 text-xs text-blue-800 dark:text-blue-300 space-y-2">
        <p className="font-semibold">No timetable needed yet.</p>
        <p>
          A private class gets its schedule per student. Once a student is
          enrolled, create the lessons for that enrollment from the enrollment —
          including the capacity of one. Save below to create the category,
          class and teacher assignment together.
        </p>
      </div>

      <div className="pt-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onFinish}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Save Complete Class ✓
        </button>
      </div>
    </div>
  );
}

function WizardDraft({
  existingCategories,
  onClose,
  onSaved,
}: {
  existingCategories: Category[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [classDraft, setClassDraft] = useState<ClassEntity | null>(null);
  const [teacherId, setTeacherId] = useState('');
  const [teachers, setTeachers] = useState<ScheduleTeachersRead | null>(null);
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const attempt = useRef<{ key: string; payload: ClassCreationInput } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    getScheduleTeachers().then(
      (result) => {
        if (active) setTeachers(result);
      },
      () => {
        if (active) setTeachers({ state: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const root = dialog.current;
    const target = Array.from(
      root?.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]),button,select',
      ) ?? [],
    ).find((el) => !el.closest('[hidden]') && !el.matches(':disabled'));
    (target ?? root)?.focus();
  }, [step]);
  const save = async (slots: ScheduleItemInput[] = []) => {
    if (busy.current || !category || !classDraft) return;
    if (!attempt.current) {
      const { name, type, price, description } = classDraft;
      attempt.current = {
        key: crypto.randomUUID(),
        payload: {
          ...(category.id === 'draft-category'
            ? {
                category: {
                  name: category.name,
                  description: category.description ?? undefined,
                },
              }
            : { category_id: category.id }),
          class: { name, type, price, description: description ?? undefined },
          teacher_ids: [
            ...new Set([
              teacherId,
              ...slots.flatMap((slot) =>
                slot.tutor_id ? [slot.tutor_id] : [],
              ),
            ]),
          ],
          schedules: type === 'private' ? [] : slots,
        },
      };
    }
    busy.current = true;
    setPending(true);
    setMessage('');
    try {
      const result = await createClassConfiguration(
        attempt.current.payload,
        attempt.current.key,
      );
      if (result.success) {
        onSaved(result.message);
        return;
      }
      setMessage(result.message);
      // A rejected replay cannot prove that an earlier unknown attempt did not commit.
      const keepOriginal = uncertain || Boolean(result.retrySameRequest);
      setUncertain(keepOriginal);
      if (!keepOriginal) attempt.current = null;
    } catch {
      setMessage(
        'Class setup could not be confirmed. Retry the same request to check its result.',
      );
      setUncertain(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-6">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-wizard-title"
        aria-busy={pending}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy.current) {
            event.preventDefault();
            onClose();
          }
          if (event.key === 'Tab') {
            const controls = Array.from(
              dialog.current?.querySelectorAll<HTMLElement>(
                'button,input:not([type="hidden"]),textarea,select,[tabindex="0"]',
              ) ?? [],
            ).filter(
              (el) => !el.closest('[hidden]') && !el.matches(':disabled'),
            );
            if (controls.length === 0) {
              event.preventDefault();
              dialog.current?.focus();
              return;
            }
            const first = controls[0],
              last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
        className="my-auto w-full max-w-2xl space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="class-wizard-title" className="text-lg font-bold">
            Class Creation Wizard
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] rounded-xl border disabled:opacity-50"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Category, class details and schedules stay in this draft until you
          save the complete class.
        </p>
        <ol
          aria-label="Class creation steps"
          className="flex justify-between gap-2 text-sm"
        >
          {['Category', 'Class Details', 'Review & Schedules'].map(
            (label, index) => (
              <li
                key={label}
                aria-current={step === index + 1 ? 'step' : undefined}
                className={step === index + 1 ? 'font-bold text-blue-600' : ''}
              >
                {index + 1}. {label}
              </li>
            ),
          )}
        </ol>
        {message && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {message}
          </p>
        )}
        {uncertain && (
          <div className="space-y-3">
            <p className="text-sm">
              Your draft is preserved. Retry the original request before making
              another class. You can also close and check the class list.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => void save()}
              className="min-h-[44px] rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              {pending ? 'Checking…' : 'Retry Same Request'}
            </button>
          </div>
        )}
        <fieldset
          disabled={pending || uncertain}
          className="min-w-0 space-y-4 disabled:opacity-60"
        >
          <div hidden={step !== 1}>
            <CategoryForm
              draft
              existingCategories={existingCategories}
              onSelectCategory={(selected) => {
                setCategory(selected);
                setStep(2);
                setMessage('');
              }}
            />
          </div>
          {category && (
            <div hidden={step !== 2}>
              <div className="mb-4 space-y-2">
                <label
                  htmlFor="class-teacher"
                  className="block text-sm font-semibold"
                >
                  Assigned Teacher
                </label>
                <select
                  id="class-teacher"
                  value={teacherId}
                  onChange={(event) => setTeacherId(event.target.value)}
                  disabled={teachers?.state !== 'ok'}
                  className="min-h-[44px] w-full rounded-xl border bg-white px-3 dark:bg-gray-900"
                >
                  <option value="">Select an active Teacher</option>
                  {teachers?.state === 'ok' &&
                    teachers.teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {!teachers
                    ? 'Loading teachers…'
                    : teachers.state === 'forbidden'
                      ? 'You do not have permission to read members. Ask a tenant administrator.'
                      : teachers.state === 'error'
                        ? 'Unable to load teachers. Close and reopen to retry.'
                        : teachers.teachers.length === 0
                          ? 'No active Teacher members. Add or activate a Teacher in Members first.'
                          : 'Choose the Teacher assigned to this class.'}
                </p>
              </div>
              <ClassForm
                draft
                selectedCategory={category}
                onClassCreated={(draft) => {
                  if (!teacherId) {
                    setMessage('Select an active Teacher before continuing.');
                    return;
                  }
                  setClassDraft(draft);
                  setStep(3);
                  setMessage('');
                }}
                onBack={() => setStep(1)}
              />
            </div>
          )}
          {classDraft && (
            <div hidden={step !== 3}>
              {classDraft.type === 'private' && (
                <>
                  <PrivateClassScheduleNotice
                    className={classDraft.name}
                    onFinish={() => void save()}
                  />
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="min-h-[44px] rounded-xl border px-4"
                  >
                    ← Back
                  </button>
                </>
              )}
              <div hidden={classDraft.type === 'private'}>
                <ScheduleForm
                  createdClass={classDraft}
                  onDraftSubmit={(slots) => void save(slots)}
                  pending={pending}
                  onScheduleSuccess={() => {}}
                  onBack={() => setStep(2)}
                />
              </div>
            </div>
          )}
        </fieldset>
        {pending && (
          <p role="status" className="text-sm">
            Saving complete class…
          </p>
        )}
      </div>
    </div>
  );
}

export function ClassCreationWizard({
  existingCategories,
  onComplete,
}: ClassCreationWizardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setIsOpen(false);
    trigger.current?.focus();
  };
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setSaved('');
          setIsOpen(true);
        }}
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
      >
        Create New Class
      </button>
      {saved && (
        <p
          role="status"
          className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {saved}
        </p>
      )}
      {isOpen && (
        <WizardDraft
          existingCategories={existingCategories}
          onClose={close}
          onSaved={(message) => {
            setSaved(message);
            close();
            onComplete?.();
          }}
        />
      )}
    </>
  );
}
