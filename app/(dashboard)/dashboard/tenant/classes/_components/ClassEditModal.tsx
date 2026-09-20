'use client';

import { useCallback, useState } from 'react';
import { ClassEditForm } from './ClassEditForm';
import type { Category, ClassEntity } from '../_lib/schema';

interface ClassEditModalProps {
  /** The class to edit. Its values seed the form every time it is opened. */
  classRecord: ClassEntity;
  /** Categories offered for reassignment, including any just created. */
  categories: Category[];
}

/**
 * Opens the class edit form in a modal from the class list.
 *
 * The form is only mounted while the modal is open, so every opening starts from
 * the current record rather than from the previous attempt's state. Closing on
 * success lets the revalidated list underneath show the saved values, which is
 * how the tenant sees the result of an edit without a manual refresh.
 */
export function ClassEditModal({ classRecord, categories }: ClassEditModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        <span>Edit</span>
        <span className="sr-only"> {classRecord.name}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
          <div className="my-auto w-full max-w-lg space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Edit Class
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Update the details parents see for “{classRecord.name}”. Class type cannot
                  be changed after creation.
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

            <ClassEditForm
              classRecord={classRecord}
              categories={categories}
              onUpdated={handleClose}
            />
          </div>
        </div>
      )}
    </>
  );
}
