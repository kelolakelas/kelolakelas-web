'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { readClassConfiguration } from '../_actions/classActions';
import { ClassConfigurationEditor } from './ClassConfigurationEditor';
import type { Category, ClassEntity, ClassSchedule } from '../_lib/schema';

interface ClassEditModalProps {
  /** The class to edit. Its values seed the form every time it is opened. */
  classRecord: ClassEntity;
  /** Categories offered for reassignment, including any just created. */
  categories: Category[];
  schedules?: ClassSchedule[];
  permissions?: readonly string[];
}

/**
 * Opens the complete editor after reloading every page of saved configuration.
 *
 * The form is only mounted while the modal is open, so every opening starts from
 * the current record rather than from the previous attempt's state. Closing on
 * Each operation reloads persisted values while keeping its own result visible.
 */
export function ClassEditModal({
  classRecord,
  permissions = [
    'class:update',
    'category:create',
    'schedule:create',
    'schedule:update',
    'schedule:delete',
  ],
}: ClassEditModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const request = useRef(0);
  const [saved, setSaved] =
    useState<Awaited<ReturnType<typeof readClassConfiguration>>['data']>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const handleClose = useCallback(() => {
    request.current++;
    setIsOpen(false);
    trigger.current?.focus();
  }, []);
  const open = async () => {
    const current = ++request.current;
    setIsOpen(true);
    setLoading(true);
    setSaved(undefined);
    setError('');
    try {
      const result = await readClassConfiguration(classRecord.id);
      if (current !== request.current) return;
      if (result.success && result.data) setSaved(result.data);
      else setError(result.message);
    } catch {
      if (current === request.current)
        setError('Saved configuration is unavailable. Retry before editing.');
    } finally {
      if (current === request.current) setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        ref={trigger}
        onClick={() => void open()}
        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
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
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        <span>Edit</span>
        <span className="sr-only"> {classRecord.name}</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={(event) => {
            if (event.key === 'Escape') handleClose();
            if (event.key === 'Tab') {
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  'button, input, select, textarea, summary, [tabindex="0"]',
                ),
              ).filter(
                (item) =>
                  !item.matches(':disabled') &&
                  item.getAttribute('type') !== 'hidden' &&
                  !item.closest('details:not([open]) :not(summary)'),
              );
              const first = items[0],
                last = items.at(-1);
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto"
        >
          <div className="my-auto w-full max-w-3xl space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
              <div>
                <h2
                  id={titleId}
                  className="text-lg font-bold text-gray-900 dark:text-gray-100"
                >
                  Edit Class
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Update the details parents see for “{classRecord.name}”. Class
                  type cannot be changed after creation.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Close modal"
                autoFocus
              >
                ✕
              </button>
            </div>

            {loading && <p role="status">Loading saved configuration…</p>}
            {error && (
              <div>
                <p role="alert">{error}</p>
                <button
                  type="button"
                  onClick={() => void open()}
                  className="min-h-[44px] rounded border px-3"
                >
                  Retry Loading Configuration
                </button>
              </div>
            )}
            {saved && (
              <ClassConfigurationEditor
                classRecord={saved.class}
                categories={saved.categories}
                schedules={saved.schedules}
                permissions={permissions}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
