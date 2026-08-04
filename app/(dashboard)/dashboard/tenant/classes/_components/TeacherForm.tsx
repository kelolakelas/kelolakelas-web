'use client';

import type { Member } from '@/lib/api/types';
import { useState } from 'react';

interface TeacherFormProps {
  teachers: Member[];
  selectedTeacherIds: string[];
  onTeachersSelected: (teacherIds: string[]) => void;
  onBack: () => void;
}

function getTeacherId(teacher: Member): string {
  return teacher.id || teacher.user_id || '';
}

function getTeacherName(teacher: Member): string {
  return [teacher.first_name, teacher.last_name].filter(Boolean).join(' ').trim() || teacher.email;
}

export function TeacherForm({
  teachers,
  selectedTeacherIds,
  onTeachersSelected,
  onBack,
}: TeacherFormProps) {
  const [teacherIds, setTeacherIds] = useState(selectedTeacherIds);

  const toggleTeacher = (teacherId: string) => {
    setTeacherIds((current) =>
      current.includes(teacherId)
        ? current.filter((id) => id !== teacherId)
        : [...current, teacherId]
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (teacherIds.length > 0) onTeachersSelected(teacherIds);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Assign Teachers</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Select one or more teachers responsible for this class.
        </p>
      </div>

      {teachers.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No active teachers are available for this tenant.
        </div>
      ) : (
        <fieldset className="space-y-2">
          <legend className="sr-only">Available teachers</legend>
          {teachers.map((teacher) => {
            const teacherId = getTeacherId(teacher);
            if (!teacherId) return null;
            const isSelected = teacherIds.includes(teacherId);
            return (
              <label
                key={teacherId}
                className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-100'
                    : 'border-gray-200 bg-white text-gray-800 hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleTeacher(teacherId)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{getTeacherName(teacher)}</span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{teacher.email}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      <div className="flex items-center justify-between gap-3 pt-3">
        <button type="button" onClick={onBack} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
          ← Back
        </button>
        <button type="submit" disabled={teacherIds.length === 0} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          Continue to Schedules →
        </button>
      </div>
    </form>
  );
}