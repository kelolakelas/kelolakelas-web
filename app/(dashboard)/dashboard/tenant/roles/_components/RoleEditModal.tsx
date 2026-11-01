'use client';

import { useCallback, useState } from 'react';
import { ModalDialog } from '@/components/ModalDialog';
import type { Permission, Role } from '../_lib/schema';
import { RoleEditForm } from './RoleEditForm';

interface RoleEditModalProps {
  role: Role;
  availablePermissions: Permission[];
}

/**
 * Opens the custom role edit form in a modal from the role list (KEL-83).
 *
 * Follows `ClassEditModal`: the form is only mounted while open, so each opening
 * starts from the current role, and closing on success lets the revalidated list
 * underneath show the saved name and permissions. Escape closes the modal.
 */
export function RoleEditModal({ role, availablePermissions }: RoleEditModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const handleClose = useCallback(() => setIsOpen(false), []);
  const titleId = `edit-role-title-${role.id}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <span>Edit</span>
        <span className="sr-only"> role {role.name}</span>
      </button>

      {isOpen && (
        <ModalDialog labelledBy={titleId} onClose={handleClose} className="p-3 sm:p-6">
          <div
            className="my-auto w-full max-w-3xl space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:p-6 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
              <div>
                <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Edit Custom Role
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Update the name, description and permissions of “{role.name}”.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <RoleEditForm
              role={role}
              availablePermissions={availablePermissions}
              onUpdated={handleClose}
              onCancel={handleClose}
            />
          </div>
        </ModalDialog>
      )}
    </>
  );
}
