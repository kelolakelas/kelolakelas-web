'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { registerInvitedUser, type InvitationActionState } from '../_actions/actions';

const initialState: InvitationActionState = {
  success: false,
  message: '',
};

type InvitationRegisterFormProps = {
  /** Verified invitation token, submitted as a form field and never displayed. */
  token: string;
  /** Address owned by the invitation row; the backend ignores any other value. */
  email: string;
  /** Pre-formatted invitation deadline, or null when the backend omitted it. */
  expiresLabel: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-xs transition-all duration-150 hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="h-5 w-5 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Creating account...
        </span>
      ) : (
        'Create account'
      )}
    </button>
  );
}

export function InvitationRegisterForm({
  token,
  email,
  expiresLabel,
}: InvitationRegisterFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(registerInvitedUser, initialState);

  useEffect(() => {
    if (state.success && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state.success, state.redirectTo, router]);

  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-xl sm:p-8">
      <div className="mb-6 text-center sm:text-left">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
          Join as a tenant member
        </h2>
        <p className="mt-1 text-xs text-gray-500 sm:text-sm">
          This invitation was sent to <span className="font-medium text-gray-700">{email}</span>.
          Set your name and password to activate the account.
        </p>
        {expiresLabel && (
          <p className="mt-2 text-xs text-gray-500 sm:text-sm">
            The invitation is valid until <span className="font-medium text-gray-700">{expiresLabel}</span>.
          </p>
        )}
      </div>

      {state.message && !state.success && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 sm:p-4 sm:text-sm"
        >
          <p className="font-medium">{state.message}</p>
        </div>
      )}

      <form action={formAction} noValidate className="space-y-4 sm:space-y-5">
        <input type="hidden" name="token" value={token} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="first_name" className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              autoComplete="given-name"
              required
              aria-invalid={Boolean(state.errors?.first_name)}
              aria-describedby={state.errors?.first_name ? 'first_name-error' : undefined}
              className={`min-h-[44px] w-full rounded-lg border px-3.5 py-2.5 text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 transition-colors ${
                state.errors?.first_name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              placeholder="John"
            />
            {state.errors?.first_name && (
              <p id="first_name-error" className="mt-1 text-xs text-red-600">
                {state.errors.first_name[0]}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="last_name" className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              autoComplete="family-name"
              required
              aria-invalid={Boolean(state.errors?.last_name)}
              aria-describedby={state.errors?.last_name ? 'last_name-error' : undefined}
              className={`min-h-[44px] w-full rounded-lg border px-3.5 py-2.5 text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 transition-colors ${
                state.errors?.last_name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              placeholder="Doe"
            />
            {state.errors?.last_name && (
              <p id="last_name-error" className="mt-1 text-xs text-red-600">
                {state.errors.last_name[0]}
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            readOnly
            aria-describedby="email-hint"
            className="min-h-[44px] w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-normal text-gray-500 focus:outline-hidden"
          />
          <p id="email-hint" className="mt-1 text-xs text-gray-500">
            This address comes from the invitation and cannot be changed here.
          </p>
        </div>

        <div>
          <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">
            Password <span className="text-red-500">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={Boolean(state.errors?.password)}
            aria-describedby={state.errors?.password ? 'password-error' : 'password-hint'}
            className={`min-h-[44px] w-full rounded-lg border px-3.5 py-2.5 text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 transition-colors ${
              state.errors?.password
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            placeholder="••••••••"
          />
          {state.errors?.password ? (
            <p id="password-error" className="mt-1 text-xs text-red-600">
              {state.errors.password[0]}
            </p>
          ) : (
            <p id="password-hint" className="mt-1 text-xs text-gray-500">
              At least 6 characters.
            </p>
          )}
        </div>

        <SubmitButton />
      </form>

      <p className="mt-5 text-center text-xs text-gray-500 sm:text-sm">
        Already used this invitation?{' '}
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          Sign in instead
        </Link>
      </p>
    </div>
  );
}
