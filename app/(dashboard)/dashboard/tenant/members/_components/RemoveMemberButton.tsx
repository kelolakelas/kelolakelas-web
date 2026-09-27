'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { removeTenantMember, type ActionResponse } from '../_actions/actions';
import type { Member } from '../_schemas/schema';

const initialState: ActionResponse = {
  success: false,
  message: '',
};

function ConfirmRemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-[44px] rounded-xl bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Removing…' : 'Remove Member'}
    </button>
  );
}

/**
 * Remove control for one tenant member (KEL-81).
 *
 * Follows the confirmation pattern of the parent enrollment cancellation
 * (KEL-45): a native `<dialog>` opened with `showModal()` traps focus, closes
 * on Escape and is labelled and described for screen readers. The request is
 * sent only by the confirm button inside the dialog, so opening and then
 * cancelling (button or Escape) sends nothing.
 *
 * A refusal (403, 404, 409, 5xx) keeps the dialog open with a plain-language
 * reason. A success closes it; the action has revalidated the page, so the
 * member leaves the list, this control unmounts with its row, and the table's
 * status region announces the outcome through `onRemoved`.
 *
 * Callers do not render this control on the signed-in user's own row. That is
 * only a convenience: identity refuses self-removal with 409 regardless.
 */
export function RemoveMemberButton({
  member,
  idPrefix,
  onRemoved,
}: {
  member: Pick<Member, 'id' | 'first_name' | 'last_name' | 'email'>;
  /** Distinguishes the mobile and desktop copies of the control, which are both in the DOM. */
  idPrefix: string;
  /**
   * Receives the success message. The action revalidates the page, so this row
   * unmounts together with anything it renders; the table announces it instead.
   */
  onRemoved: (message: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(
    async (previous: ActionResponse, formData: FormData) => {
      const result = await removeTenantMember(previous, formData);
      if (result.success) {
        onRemoved(result.message);
      }
      return result;
    },
    initialState
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const memberName = `${member.first_name} ${member.last_name}`.trim() || member.email;
  const titleId = `${idPrefix}-remove-member-title-${member.id}`;
  const descriptionId = `${idPrefix}-remove-member-description-${member.id}`;

  useEffect(() => {
    if (state.success && dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, [state]);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setDialogOpen(true);
          dialogRef.current?.showModal();
        }}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:border-red-900/50 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <span>Remove</span>
        <span className="sr-only"> {memberName} from the organization</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => setDialogOpen(false)}
        className="m-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-left whitespace-normal text-gray-900 shadow-2xl backdrop:bg-black/50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        <h2 id={titleId} className="text-lg font-bold">
          Remove {memberName} from the organization?
        </h2>
        <p id={descriptionId} className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {member.email} will lose access to this organization&apos;s dashboard and every action
          that needs a tenant permission. Their account is not deleted, and removal cannot be undone
          from this page.
        </p>

        <form action={formAction} className="mt-6 flex flex-wrap justify-end gap-3">
          <input type="hidden" name="memberId" value={member.id} />
          <input type="hidden" name="memberName" value={memberName} />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <ConfirmRemoveButton />
        </form>

        {dialogOpen && !state.success && state.message && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
        )}
      </dialog>
    </div>
  );
}
