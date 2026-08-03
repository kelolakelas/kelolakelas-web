'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import type { ClassDraft, ScheduleItemInput } from '../_lib/schema';

function SubmitScheduleButton({ pending, isPrivate }: { pending: boolean; isPrivate: boolean }) {
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
        isPrivate ? 'Create Without Schedule ✓' : 'Complete Class Setup ✓'
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
  createdClass: ClassDraft;
  onScheduleSuccess: (schedules: ScheduleItemInput[]) => void;
  onBack: () => void;
  isSubmitting: boolean;
  errorMessage?: string;
  successMessage?: string;
}

export function ScheduleForm({
  createdClass,
  onScheduleSuccess,
  onBack,
  isSubmitting,
  errorMessage,
  successMessage,
}: ScheduleFormProps) {
  const [schedules, setSchedules] = useState<ScheduleItemInput[]>([
    {
      day_of_week: 1,
      start_time: '09:00',
      end_time: '10:30',
      location: 'Room 101',
    },
  ]);

  const addScheduleSlot = () => {
    setSchedules((prev) => [
      ...prev,
      {
        day_of_week: 3, // default Wednesday
        start_time: '14:00',
        end_time: '15:30',
        location: '',
      },
    ]);
  };

  const removeScheduleSlot = (index: number) => {
    if (schedules.length <= 1) return;
    setSchedules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateScheduleSlot = <K extends keyof ScheduleItemInput>(
    index: number,
    field: K,
    value: ScheduleItemInput[K]
  ) => {
    setSchedules((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onScheduleSuccess(createdClass.type === 'private' ? [] : schedules);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Created Class Details Header */}
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-4 py-3 text-xs">
        <div>
          <span className="text-gray-500 dark:text-gray-400 block">Class Configured:</span>
          <span className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
            {createdClass.name}
          </span>
          <span className="ml-2 inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-200">
            {createdClass.type}
          </span>
        </div>
      </div>

      {/* Global Error Notice */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          {successMessage}
        </div>
      )}

      {createdClass.type === 'private' ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          Private classes do not require a recurring schedule. A schedule can be created later from a parent enrollment and tenant member approval.
        </div>
      ) : (
        <div className="space-y-4">
        <div className="flex items-center justify-between">
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
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Slot
          </button>
        </div>

        <div className="space-y-3">
          {schedules.map((slot, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/80 p-4 shadow-xs space-y-3 relative"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/60 pb-2">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Slot #{idx + 1}
                </span>
                {schedules.length > 1 && (
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Day Selection */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Day of Week
                  </label>
                  <select
                    value={slot.day_of_week}
                    onChange={(e) =>
                      updateScheduleSlot(idx, 'day_of_week', Number(e.target.value))
                    }
                    className="block min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.id} value={day.id}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Time */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={slot.start_time}
                    onChange={(e) => updateScheduleSlot(idx, 'start_time', e.target.value)}
                    required
                    className="block min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* End Time */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={slot.end_time}
                    onChange={(e) => updateScheduleSlot(idx, 'end_time', e.target.value)}
                    required
                    className="block min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Location optional input */}
              <div className="pt-1">
                <input
                  type="text"
                  placeholder="Location / Room (e.g., Room 102 or Online Zoom Link)"
                  value={slot.location || ''}
                  onChange={(e) => updateScheduleSlot(idx, 'location', e.target.value)}
                  className="block min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      {/* Form Action Controls */}
      <div className="pt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          ← Back
        </button>
        <SubmitScheduleButton pending={isSubmitting} isPrivate={createdClass.type === 'private'} />
      </div>
    </form>
  );
}
