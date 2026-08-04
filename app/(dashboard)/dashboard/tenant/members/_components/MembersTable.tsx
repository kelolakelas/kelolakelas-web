'use client';

import type { Member } from '../_schemas/schema';
import { DeleteMemberButton } from './DeleteMemberButton';

interface MembersTableProps {
  members: Member[];
}

export function MembersTable({ members }: MembersTableProps) {
  if (!members || members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-3">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">No Members Found</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          There are no registered tenant members yet. Use the invitation tool to invite team members.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Stacked Cards Layout (block on mobile, hidden on md) */}
      <div className="block md:hidden space-y-3">
        {members.map((member) => {
          const roleName = member.role?.name || member.role_id || 'Member';
          const status = member.status || 'active';

          return (
            <div
              key={member.id}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-4 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    {member.first_name} {member.last_name}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : status === 'pending'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700/50">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Role:</span>
                <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                  {roleName}
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                {member.id && <DeleteMemberButton memberId={member.id} memberName={`${member.first_name} ${member.last_name}`} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Data Table Layout (hidden on mobile, table on md) */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-xs">
        <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
          <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-6 py-3.5">
                Member
              </th>
              <th scope="col" className="px-6 py-3.5">
                Role
              </th>
              <th scope="col" className="px-6 py-3.5">
                Status
              </th>
              <th scope="col" className="px-6 py-3.5 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700/60">
            {members.map((member) => {
              const roleName = member.role?.name || member.role_id || 'Member';
              const status = member.status || 'active';

              return (
                <tr
                  key={member.id}
                  className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {member.first_name} {member.last_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                      {roleName}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : status === 'pending'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {member.id && <DeleteMemberButton memberId={member.id} memberName={`${member.first_name} ${member.last_name}`} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
