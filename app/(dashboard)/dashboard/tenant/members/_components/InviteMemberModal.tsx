'use client';

import { useState } from 'react';
import type { ActionResponse } from '../_actions/actions';
import type { Permission, Role } from '../_schemas/schema';
import { InviteMemberForm } from './InviteMemberForm';

interface InviteMemberModalProps {
  roles: Role[];
  permissions?: Permission[];
}

export function InviteMemberModal({ roles, permissions = [] }: InviteMemberModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  // The modal closes on a fully delivered invitation only. When the backend
  // stored the invitation but the email failed (emailSent === false, KEL-36),
  // the form stays open so the tenant reads the warning and can retry later.
  const handleInviteSuccess = (state: ActionResponse) => {
    if (state.emailSent !== false) {
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Invite Member</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Invite New Member
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Send an email invitation to add a team member to your tenant organization.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close invitation modal"
              >
                ✕
              </button>
            </div>

            <InviteMemberForm
              roles={roles}
              permissions={permissions}
              onSuccess={handleInviteSuccess}
            />
          </div>
        </div>
      )}
    </>
  );
}
