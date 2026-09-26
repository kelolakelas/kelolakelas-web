'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { revokeTenantInvitation, type ActionResponse } from '../_actions/actions';
import type { InvitationListItem } from '../_schemas/schema';

const initialState: ActionResponse = {
  success: false,
  message: '',
};

function ConfirmRevokeButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-[44px] rounded-xl bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Revoking…' : 'Revoke Invitation'}
    </button>
  );
}

/**
 * Revoke control for one pending invitation (KEL-84).
 *
 * Follows the `DeleteRoleButton` confirmation pattern: a native `<dialog>`
 * opened with `showModal()` traps focus, closes on Escape and is labelled for
 * screen readers. A refusal (403, 404) keeps the dialog open with the reason.
 * A success closes it; the action has revalidated the page, so the invitation
 * leaves the list and the Pending Invites count drops.
 */
export function RevokeInvitationButton({
  invitation,
}: {
  invitation: Pick<InvitationListItem, 'id' | 'email'>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(revokeTenantInvitation, initialState);
  const [dialogOpen, setDialogOpen] = useState(false);
  const titleId = `revoke-invitation-title-${invitation.id}`;
  const descriptionId = `revoke-invitation-description-${invitation.id}`;

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
        className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:border-red-900/50 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30"
      >
        <span>Revoke</span>
        <span className="sr-only"> invitation for {invitation.email}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => setDialogOpen(false)}
        className="m-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl backdrop:bg-black/50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        <h2 id={titleId} className="text-lg font-bold">
          Revoke invitation for {invitation.email}?
        </h2>
        <p id={descriptionId} className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          The invitation link in the email will stop working. You can send a new invitation to this
          address later.
        </p>

        <form action={formAction} className="mt-6 flex flex-wrap justify-end gap-3">
          <input type="hidden" name="invitationId" value={invitation.id} />
          <input type="hidden" name="email" value={invitation.email} />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <ConfirmRevokeButton />
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
