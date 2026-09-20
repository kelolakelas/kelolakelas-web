'use client';

import { useFormStatus } from 'react-dom';
import { logoutAction } from '../_actions/actions';

const BASE_BUTTON_CLASS = 'flex items-center gap-2 font-semibold transition-colors disabled:opacity-60';

/**
 * Submit button for the logout form. It reads `useFormStatus` so the label reflects
 * the in-flight action, and it disables itself so a double tap cannot submit twice.
 */
function LogoutSubmitButton({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={`${BASE_BUTTON_CLASS} ${className}`}>
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
      <span>{pending ? 'Keluar…' : label}</span>
    </button>
  );
}

/**
 * Ends the session through the `logoutAction` Server Action.
 *
 * It is a plain form so it keeps working without client JavaScript. `className` lets
 * every surface keep its own visual language — the tenant shell and the parent pages
 * do not share a palette — while the behaviour stays in one place.
 */
export function LogoutButton({ label = 'Keluar', className }: { label?: string; className?: string }) {
  return (
    <form action={logoutAction}>
      <LogoutSubmitButton
        label={label}
        className={className || 'min-h-[44px] w-full rounded-xl px-3 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60'}
      />
    </form>
  );
}
