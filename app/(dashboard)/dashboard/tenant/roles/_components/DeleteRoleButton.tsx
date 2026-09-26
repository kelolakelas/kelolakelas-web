'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteTenantRole } from '../_actions/roleActions';
import type { ActionResponse, Role } from '../_lib/schema';

const initialState: ActionResponse = {
  success: false,
  message: '',
};

function ConfirmDeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-[44px] rounded-xl bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Deleting…' : 'Delete Role'}
    </button>
  );
}

/**
 * Delete control for one custom role (KEL-83).
 *
 * Confirmation uses the platform `<dialog>` opened with `showModal()`, as in
 * `CancelEnrollmentButton`: the native modal traps focus, closes on Escape and
 * is labelled/described for screen readers. A refusal (403, 404, or the 409
 * "still assigned to active members") keeps the dialog open with the reason and
 * the role stays in the list. A success closes the dialog; the action has
 * revalidated the page, so the role disappears from the list.
 */
export function DeleteRoleButton({ role }: { role: Pick<Role, 'id' | 'name'> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState(deleteTenantRole, initialState);
  const [dialogOpen, setDialogOpen] = useState(false);
  const titleId = `delete-role-title-${role.id}`;
  const descriptionId = `delete-role-description-${role.id}`;

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
        <span>Delete</span>
        <span className="sr-only"> role {role.name}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => setDialogOpen(false)}
        className="m-auto max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl backdrop:bg-black/50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        <h2 id={titleId} className="text-lg font-bold">
          Delete role “{role.name}”?
        </h2>
        <p id={descriptionId} className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          This custom role will be removed from your organization. A role that is still assigned to
          members cannot be deleted. This action cannot be undone.
        </p>

        <form action={formAction} className="mt-6 flex flex-wrap justify-end gap-3">
          <input type="hidden" name="roleId" value={role.id} />
          <input type="hidden" name="roleName" value={role.name} />
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <ConfirmDeleteButton />
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
