'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  classPublicationNextValue,
  classPublicationPresentation,
  enrollmentStatusPresentation,
  type ClassPublicationFields,
  type ClassPublicationTone,
} from '@/lib/class-publication';
import { updateClassPublication } from '../_actions/classActions';
import type { ActionResponse } from '../_actions/classActions';

const TONE_BADGE_CLASSES: Record<ClassPublicationTone, string> = {
  success:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const initialActionState: ActionResponse = { success: false, message: '' };

/**
 * Publication and enrollment badges for a tenant class.
 *
 * Both fields determine whether the class is reachable from `/kelas`, so they
 * are always shown together.
 */
export function ClassStatusBadges({
  record,
}: {
  record: ClassPublicationFields | null | undefined;
}) {
  const publication = classPublicationPresentation(record);
  const enrollment = enrollmentStatusPresentation(record?.enrollment_status);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${TONE_BADGE_CLASSES[publication.tone]}`}
        title={publication.detail}
      >
        {publication.label}
      </span>
      <span
        className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold ${TONE_BADGE_CLASSES[enrollment.tone]}`}
      >
        {enrollment.label}
      </span>
    </div>
  );
}

function PublicationSubmitButton({ isPublishing }: { isPublishing: boolean }) {
  const { pending } = useFormStatus();
  // `disabled` while pending prevents a second submission from a double click;
  // Next.js also dispatches Server Actions sequentially per client.
  const label = isPublishing ? 'Publish' : 'Unpublish';

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[36px] ${
        isPublishing
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-950'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
      }`}
    >
      {pending && (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
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
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {pending ? (isPublishing ? 'Publishing…' : 'Unpublishing…') : label}
    </button>
  );
}

/**
 * Server-Action backed publish/unpublish control for a single class.
 *
 * The tenant is taken from the session cookie on the server; only the class
 * identifier is submitted from the browser.
 */
export function ClassPublicationButton({
  classId,
  record,
}: {
  classId: string;
  record: ClassPublicationFields | null | undefined;
}) {
  const [state, formAction] = useActionState(
    updateClassPublication,
    initialActionState
  );

  const isPublishing = classPublicationNextValue(record);

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="is_published" value={String(isPublishing)} />
      <PublicationSubmitButton isPublishing={isPublishing} />
      {state.message && (
        <p
          role={state.success ? 'status' : 'alert'}
          className={`max-w-xs text-[11px] leading-snug ${
            state.success
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-red-700 dark:text-red-400'
          }`}
        >
          {state.message}
        </p>
      )}
      {!state.message && (
        <span className="sr-only">{classPublicationPresentation(record).detail}</span>
      )}
    </form>
  );
}