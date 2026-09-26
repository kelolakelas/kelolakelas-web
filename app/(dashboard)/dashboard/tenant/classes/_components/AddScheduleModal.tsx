'use client';

import { useCallback, useState } from 'react';
import { ScheduleForm } from './ScheduleForm';
import type { ClassEntity } from '../_lib/schema';

interface AddScheduleModalProps {
  /** The group class the new schedules belong to. */
  classRecord: ClassEntity;
}

/**
 * Opens the schedule form in a modal from the class list.
 *
 * A group class whose schedules were never created (or whose creation failed
 * mid-wizard) has no row to edit, so this is the recovery path: the same
 * ScheduleForm the wizard renders is reused, which keeps the required
 * per-slot capacity and its validation identical on both paths. The action
 * behind the form revalidates the classes screen, so closing on success lets
 * the refreshed list underneath show the new schedule rows.
 */
export function AddScheduleModal({ classRecord }: AddScheduleModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-gray-800"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        <span>Add Schedule</span>
        <span className="sr-only"> {classRecord.name}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
          <div className="my-auto w-full max-w-2xl space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Add Schedules
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Add weekly recurring slots to “{classRecord.name}”. Existing
                  schedules and enrollments are not changed.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <ScheduleForm
              createdClass={classRecord}
              onScheduleSuccess={handleClose}
              onBack={handleClose}
            />
          </div>
        </div>
      )}
    </>
  );
}
