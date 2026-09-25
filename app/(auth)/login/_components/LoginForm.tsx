'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { loginAction, type ActionResponse } from '../_actions/actions';

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
      className="flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-150"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="h-4 w-4 animate-spin text-white"
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
          Signing in...
        </span>
      ) : (
        'Sign in'
      )}
    </button>
  );
}

export function LoginForm({ registered = false, redirectTo }: { registered?: boolean; redirectTo?: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-gray-100">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Welcome Back</h2>
        <p className="mt-1 text-sm text-gray-500">Sign in to your KelolaKelas account</p>
      </div>

      {registered && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
        >
          <p className="font-medium">Account created successfully. Sign in to continue.</p>
        </div>
      )}

      {state.message && !state.success && (
        <div
          role="alert"
          className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-700"
        >
          <p className="font-medium">{state.message}</p>
        </div>
      )}

      <form action={formAction} noValidate className="space-y-5">
        {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(state.errors?.email)}
            aria-describedby={state.errors?.email ? 'email-error' : undefined}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 transition-colors ${
              state.errors?.email
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            placeholder="you@example.com"
          />
          {state.errors?.email && (
            <p id="email-error" className="mt-1.5 text-xs text-red-600">
              {state.errors.email[0]}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(state.errors?.password)}
            aria-describedby={state.errors?.password ? 'password-error' : undefined}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm font-normal text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 transition-colors ${
              state.errors?.password
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            placeholder="••••••••"
          />
          {state.errors?.password && (
            <p id="password-error" className="mt-1.5 text-xs text-red-600">
              {state.errors.password[0]}
            </p>
          )}
        </div>

        <SubmitButton />
        <a href="/platform/login" className="block text-center text-sm text-indigo-700 underline">Platform admin sign in</a>
      </form>
    </div>
  );
}
