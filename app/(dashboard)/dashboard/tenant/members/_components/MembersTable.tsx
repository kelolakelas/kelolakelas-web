'use client';

import { useActionState, useState } from 'react';
import { updateMemberRole, type ActionResponse } from '../_actions/actions';
import type { Member, Role } from '../_schemas/schema';

interface MembersTableProps {
  members: Member[];
  roles: Role[];
}

export function MembersTable({ members, roles }: MembersTableProps) {
  const [roleState, roleAction, rolePending] = useActionState(updateMemberRole, { success: false, message: '' } satisfies ActionResponse);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const filteredMembers = members.filter((member) => {
    const searchValue = `${member.first_name} ${member.last_name} ${member.email} ${member.phone || ''}`.toLowerCase();
    const matchesSearch = searchValue.includes(search.toLowerCase().trim());
    const matchesStatus = statusFilter === 'all' || (member.status || 'active') === statusFilter;
    const matchesRole = roleFilter === 'all' || (member.role_id || member.role?.id) === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

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
      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-3">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, email, atau telepon" className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" aria-label="Filter status">
          <option value="all">Semua status</option><option value="active">Aktif</option><option value="pending">Menunggu</option><option value="inactive">Tidak aktif</option>
        </select>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm" aria-label="Filter role">
          <option value="all">Semua role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </div>
      {filteredMembers.length === 0 && <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">Tidak ada anggota yang cocok dengan filter.</div>}
      {/* Mobile Stacked Cards Layout (block on mobile, hidden on md) */}
      <div className="block md:hidden space-y-3">
        {filteredMembers.map((member) => {
          const roleName = member.role?.name || member.role_id || 'Member';
          const permissions = member.permissions || member.role?.permissions || [];
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

              {permissions.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium block">
                    Permissions:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {permissions.map((perm) => (
                      <span
                        key={perm.id}
                        className="inline-flex items-center rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-300"
                      >
                        {perm.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <form action={roleAction} className="flex items-center gap-2" onSubmit={(event) => { if (!window.confirm('Ubah role member ini?')) event.preventDefault(); }}><input type="hidden" name="member_id" value={member.id} /><select name="role_id" defaultValue={member.role_id || member.role?.id || ''} className="min-h-11 max-w-32 rounded-lg border border-gray-300 px-2 text-xs">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button disabled={rolePending} className="min-h-11 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 disabled:opacity-50">Simpan</button></form>
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
                Permissions
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
            {filteredMembers.map((member) => {
              const roleName = member.role?.name || member.role_id || 'Member';
              const permissions = member.permissions || member.role?.permissions || [];
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
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {permissions.length > 0 ? (
                        permissions.map((perm) => (
                          <span
                            key={perm.id}
                            className="inline-flex items-center rounded bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300"
                          >
                            {perm.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">No explicit permissions</span>
                      )}
                    </div>
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
                    <form action={roleAction} className="flex items-center gap-2" onSubmit={(event) => { if (!window.confirm('Ubah role member ini?')) event.preventDefault(); }}><input type="hidden" name="member_id" value={member.id} /><select name="role_id" defaultValue={member.role_id || member.role?.id || ''} className="min-h-11 max-w-32 rounded-lg border border-gray-300 px-2 text-xs">{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button disabled={rolePending} className="min-h-11 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 disabled:opacity-50">Simpan</button></form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {roleState.message && <p role="status" className={roleState.success ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>{roleState.message}</p>}

    </div>
  );
}
