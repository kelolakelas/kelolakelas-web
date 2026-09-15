'use client';

import { useActionState, useState } from 'react';
import { createTenantRole } from '../_actions/roleActions';
import type { ActionResponse, Permission } from '../_lib/schema';
import { PermissionSelector } from './PermissionSelector';

interface RoleCreationFormProps {
  availablePermissions: Permission[];
  onSuccess?: () => void;
}

const initialState: ActionResponse = {
  success: false,
  message: '',
};

export function RoleCreationForm({
  availablePermissions,
  onSuccess,
}: RoleCreationFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

  const [state, formAction, isPending] = useActionState(
    async (previousState: ActionResponse, formData: FormData) => {
      const nextState = await createTenantRole(previousState, formData);

      if (nextState.success) {
        // Reset controlled fields as part of the submit action, avoiding a
        // synchronous state update from an effect after the action completes.
        setName('');
        setDescription('');
        setSelectedPermissionIds([]);
        onSuccess?.();
      }

      return nextState;
    },
    initialState
  );

  const handleReset = () => {
    setName('');
    setDescription('');
    setSelectedPermissionIds([]);
  };

  const nameError = state.errors?.name?.[0];
  const descriptionError = state.errors?.description?.[0];
  const permissionIdsError = state.errors?.permissionIds?.[0];

  return (
    <form action={formAction} className="space-y-6">
      {/* Banner Feedback Messages */}
      {state.message && (
        <div
          className={`rounded-2xl border p-4 text-xs font-medium flex items-start gap-3 transition-all ${
            state.success
              ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
              : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
          }`}
        >
          {state.success ? (
            <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold">{state.success ? 'Success: ' : 'Error: '}</span>
            {state.message}
          </div>
        </div>
      )}

      {/* Basic Role Information Card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-xs space-y-4">
        <div className="border-b border-gray-100 dark:border-gray-800 pb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Role Profile Details
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Specify a descriptive identifier and clear description for the custom role.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Role Name */}
          <div className="space-y-1.5">
            <label htmlFor="role-name" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              id="role-name"
              type="text"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior Tutor, Academic Coordinator"
              maxLength={50}
              required
              className={`w-full min-h-[44px] rounded-xl border bg-white dark:bg-gray-900 px-3.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-colors ${
                nameError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-200 dark:border-gray-800 focus:border-blue-500 focus:ring-blue-500'
              }`}
            />
            {nameError && <p className="text-[11px] text-red-500 mt-1">{nameError}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="role-description" className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Description
            </label>
            <input
              id="role-description"
              type="text"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Responsible for managing class schedules and rosters"
              maxLength={200}
              className={`w-full min-h-[44px] rounded-xl border bg-white dark:bg-gray-900 px-3.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-colors ${
                descriptionError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-200 dark:border-gray-800 focus:border-blue-500 focus:ring-blue-500'
              }`}
            />
            {descriptionError && (
              <p className="text-[11px] text-red-500 mt-1">{descriptionError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Permission Selection Component */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-xs">
        <PermissionSelector
          permissions={availablePermissions}
          selectedPermissionIds={selectedPermissionIds}
          onChange={setSelectedPermissionIds}
          error={permissionIdsError}
        />
      </div>

      {/* Form Action Controls */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={isPending}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Reset Form
        </button>

        <button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Creating Custom Role...</span>
            </>
          ) : (
            <span>Create Custom Role</span>
          )}
        </button>
      </div>
    </form>
  );
}
