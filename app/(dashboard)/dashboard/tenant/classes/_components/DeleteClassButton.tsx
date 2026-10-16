'use client';

import { useId, useRef, useState } from 'react';
import { deleteClass, type ActionResponse } from '../_actions/classActions';

export function DeleteClassButton({
  classId,
  className,
}: {
  classId: string;
  className: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResponse | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  async function confirm() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setResult(null);
    try {
      const response = await deleteClass(classId);
      setResult(response);
      if (response.success) dialog.current?.close();
    } catch {
      setResult({
        success: false,
        message:
          'The deletion could not be confirmed. Check the class list before trying again.',
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <>
      {result?.success ? (
        <p role="status" className="text-sm">
          {result.message}
        </p>
      ) : (
        <button
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          aria-label={`Delete class ${className}`}
          onClick={() => {
            setResult(null);
            dialog.current?.showModal();
          }}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-800 dark:bg-gray-900 dark:text-red-300"
        >
          Delete
        </button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          if (busy.current) event.preventDefault();
        }}
        onClose={() => trigger.current?.focus()}
        className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 text-gray-900 shadow-2xl backdrop:bg-black/60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        <h2 id={titleId} className="break-words text-lg font-bold">
          Delete “{className}”?
        </h2>
        <p id={descriptionId} className="mt-3 text-sm">
          This class will be removed from the catalog and class list. Classes
          with active enrollments cannot be deleted.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
          className="mt-5 space-y-4"
        >
          {result && !result.success && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
            >
              {result.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              autoFocus
              disabled={pending}
              onClick={() => dialog.current?.close()}
              className="min-h-[44px] rounded-lg border px-4 text-sm disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="min-h-[44px] rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? 'Deleting…' : 'Confirm Delete Class'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
