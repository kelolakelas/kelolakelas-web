'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { inviteTenantMember, type ActionResponse } from '../_actions/actions';
import type { Permission, Role } from '../_schemas/schema';

interface InviteMemberFormProps {
  roles: Role[];
  permissions?: Permission[];
  /**
   * Called once with the settled action state after a successful submission.
   * Receives the state so the caller can react to the delivery outcome
   * (`state.emailSent`) instead of only the submission success (KEL-36).
   */
  onSuccess?: (state: ActionResponse) => void;
}

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
      className="inline-flex min-h-[44px] min-w-[44px] w-full sm:w-auto items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Sending Invitation...
        </span>
      ) : (
        'Send Invitation'
      )}
    </button>
  );
}

export function InviteMemberForm({ roles, permissions = [], onSuccess }: InviteMemberFormProps) {
  const [state, formAction] = useActionState(inviteTenantMember, initialState);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  useEffect(() => {
    if (state.success && onSuccess) {
      onSuccess(state);
    }
  }, [state, onSuccess]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const activePermissions = selectedRole?.permissions && selectedRole.permissions.length > 0 
    ? selectedRole.permissions 
    : permissions;

  return (
    <form action={formAction} className="space-y-5 text-gray-900 dark:text-gray-100">
      {state.message && (
        <div
          role="alert"
          className={`rounded-lg p-4 text-sm font-medium ${
            state.success
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}
        >
          {state.message}
        </div>
      )}

      {/* Email Input */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="colleague@company.com"
          aria-invalid={!!state.errors?.email}
          aria-describedby={state.errors?.email ? 'email-error' : undefined}
          className="block w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-base sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {state.errors?.email && (
          <p id="email-error" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
            {state.errors.email[0]}
          </p>
        )}
      </div>

      {/* Role Selection Dropdown */}
      <div>
        <label htmlFor="roleId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Assign Role <span className="text-red-500">*</span>
        </label>
        <select
          id="roleId"
          name="roleId"
          required
          value={selectedRoleId}
          onChange={(e) => setSelectedRoleId(e.target.value)}
          aria-invalid={!!state.errors?.roleId}
          aria-describedby={state.errors?.roleId ? 'role-error' : undefined}
          className="block w-full min-h-[44px] rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-base sm:text-sm text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">-- Select a Role --</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name} {role.is_system_role ? '(System Role)' : ''}
            </option>
          ))}
        </select>
        {state.errors?.roleId && (
          <p id="role-error" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
            {state.errors.roleId[0]}
          </p>
        )}
      </div>

      {/* Permissions Section */}
      {activePermissions.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Assigned Permissions
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            {activePermissions.map((perm) => (
              <label
                key={perm.id}
                className="inline-flex min-h-[44px] items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                <input
                  type="checkbox"
                  name="permissionIds"
                  value={perm.id}
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium">{perm.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Form Submission */}
      <div className="pt-2 flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
