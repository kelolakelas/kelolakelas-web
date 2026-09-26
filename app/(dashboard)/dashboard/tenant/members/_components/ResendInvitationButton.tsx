'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { resendTenantInvitation, type ActionResponse } from '../_actions/actions';
import type { InvitationListItem } from '../_schemas/schema';

const initialState: ActionResponse = {
  success: false,
  message: '',
};

function SubmitResendButton({ email }: { email: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-blue-400 dark:hover:bg-blue-950/30"
    >
      <span>{pending ? 'Resending…' : 'Resend'}</span>
      <span className="sr-only"> invitation to {email}</span>
    </button>
  );
}

/**
 * Resend control for one invitation (KEL-84).
 *
 * The outcome is shown like the invite form (KEL-36): a stored invitation is a
 * success even when the email failed, so the delivery state picks the tone
 * (green when sent, amber when stored but not sent) and a refusal such as the
 * 409 "account already exists" is shown in red.
 */
export function ResendInvitationButton({
  invitation,
}: {
  invitation: Pick<InvitationListItem, 'id' | 'email' | 'role_id'>;
}) {
  const [state, formAction] = useActionState(resendTenantInvitation, initialState);

  let tone =
    'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200';
  if (state.success) {
    tone = state.emailSent
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
  }

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="email" value={invitation.email} />
        <input type="hidden" name="roleId" value={invitation.role_id} />
        <SubmitResendButton email={invitation.email} />
      </form>
      {state.message && (
        <p
          role={state.success ? 'status' : 'alert'}
          className={`rounded-lg border px-3 py-2 text-xs font-medium ${tone}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
