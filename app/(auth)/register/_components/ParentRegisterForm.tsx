'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { registerParent, type ActionResponse } from '../_actions/actions';

const initialState: ActionResponse = {
  success: false,
  message: '',
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
          Registering Parent...
        </span>
      ) : (
        'Register as Parent'
      )}
    </button>
  );
}

export function ParentRegisterForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(registerParent, initialState);

  useEffect(() => {
    if (state.success && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [state.success, state.redirectTo, router]);

  return (
    <div className="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-xl sm:p-8">
      <div className="mb-6 text-center sm:text-left">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
          Register as Parent
        </h2>
        <p className="mt-1 text-xs text-gray-500 sm:text-sm">
          Create an account to manage your students and courses
        </p>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="first_name" className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
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
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(state.errors?.email)}
            aria-describedby={state.errors?.email ? 'email-error' : undefined}
            className={`min-h-[44px] w-full rounded-lg border px-3.5 py-2.5 text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 transition-colors ${
              state.errors?.email
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            placeholder="parent@example.com"
          />
          {state.errors?.email && (
            <p id="email-error" className="mt-1 text-xs text-red-600">
              {state.errors.email[0]}
            </p>
          )}
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
            aria-describedby={state.errors?.password ? 'password-error' : undefined}
            className={`min-h-[44px] w-full rounded-lg border px-3.5 py-2.5 text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 transition-colors ${
              state.errors?.password
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            placeholder="••••••••"
          />
          {state.errors?.password && (
            <p id="password-error" className="mt-1 text-xs text-red-600">
              {state.errors.password[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1 sm:text-sm">
            Phone Number <span className="text-gray-400">(Optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={Boolean(state.errors?.phone)}
            aria-describedby={state.errors?.phone ? 'phone-error' : undefined}
            className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm font-normal text-gray-900 placeholder-gray-400 hover:border-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 transition-colors"
            placeholder="+1 (555) 000-0000"
          />
          {state.errors?.phone && (
            <p id="phone-error" className="mt-1 text-xs text-red-600">
              {state.errors.phone[0]}
            </p>
          )}
        </div>

        <SubmitButton />
      </form>
    </div>
  );
}
