'use client';

import { useActionState, useState } from 'react';
import { updateTenantRole } from '../_actions/roleActions';
import type { ActionResponse, Permission, Role } from '../_lib/schema';
import { PermissionSelector } from './PermissionSelector';

interface RoleEditFormProps {
  role: Role;
  availablePermissions: Permission[];
  onUpdated?: () => void;
  onCancel?: () => void;
}

const initialState: ActionResponse = {
  success: false,
  message: '',
};

/**
 * Edit form for one custom role (KEL-83).
 *
 * Field limits mirror `RoleCreationForm`, and the Server Action validates with
 * `updateRoleSchema`, which applies the same rules as `createRoleSchema`, so an
 * edit is held to the same validation as creating the role.
 */
export function RoleEditForm({ role, availablePermissions, onUpdated, onCancel }: RoleEditFormProps) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>(() =>
    (role.permissions ?? []).map((permission) => permission.id).filter(Boolean)
  );

  const [state, formAction, isPending] = useActionState(
    async (previousState: ActionResponse, formData: FormData) => {
      const nextState = await updateTenantRole(previousState, formData);
      if (nextState.success) {
        onUpdated?.();
      }
      return nextState;
    },
    initialState
  );

  const nameError = state.errors?.name?.[0];
  const descriptionError = state.errors?.description?.[0];
  const permissionIdsError = state.errors?.permissionIds?.[0];
  const nameId = `edit-role-name-${role.id}`;
  const descriptionId = `edit-role-description-${role.id}`;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="roleId" value={role.id} />

      {state.message && !state.success && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4 text-xs font-medium text-red-800 dark:text-red-300"
        >
          <span className="font-semibold">Error: </span>
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Role Name <span className="text-red-500">*</span>
          </label>
          <input
            id={nameId}
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            required
            aria-invalid={nameError ? true : undefined}
            className={`w-full min-h-[44px] rounded-xl border bg-white dark:bg-gray-900 px-3.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-colors ${
              nameError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-200 dark:border-gray-800 focus:border-blue-500 focus:ring-blue-500'
            }`}
          />
          {nameError && <p className="text-[11px] text-red-500 mt-1">{nameError}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={descriptionId} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Description
          </label>
          <input
            id={descriptionId}
            type="text"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            aria-invalid={descriptionError ? true : undefined}
            className={`w-full min-h-[44px] rounded-xl border bg-white dark:bg-gray-900 px-3.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-colors ${
              descriptionError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-200 dark:border-gray-800 focus:border-blue-500 focus:ring-blue-500'
            }`}
          />
          {descriptionError && <p className="text-[11px] text-red-500 mt-1">{descriptionError}</p>}
        </div>
      </div>

      <PermissionSelector
        permissions={availablePermissions}
        selectedPermissionIds={selectedPermissionIds}
        onChange={setSelectedPermissionIds}
        error={permissionIdsError}
      />

      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50"
        >
          {isPending ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
