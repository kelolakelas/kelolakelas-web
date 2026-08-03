'use client';

import { useActionState, useMemo, useState } from 'react';
import { deleteTenantRole, updateTenantRole } from '../_actions/roleActions';
import type { ActionResponse, Role } from '../_lib/schema';

interface RoleListTableProps {
  roles: Role[];
}

export function RoleListTable({ roles }: RoleListTableProps) {
  const [filterTab, setFilterTab] = useState<'all' | 'system' | 'custom'>('all');
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [updateState, updateAction] = useActionState<ActionResponse, FormData>(updateTenantRole, { success: false, message: '' });
  const [deleteState, deleteAction] = useActionState<ActionResponse, FormData>(deleteTenantRole, { success: false, message: '' });

  const filteredRoles = useMemo(() => {
    if (filterTab === 'system') {
      return roles.filter((role) => role.is_system_role);
    }
    if (filterTab === 'custom') {
      return roles.filter((role) => !role.is_system_role);
    }
    return roles;
  }, [roles, filterTab]);

  const toggleExpand = (id: string) => {
    setExpandedRoleId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Configured Tenant Roles ({roles.length})
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Review built-in system roles and organization custom access policies.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800/80 p-1 border border-gray-200/50 dark:border-gray-700/50 text-xs">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`min-h-[36px] px-3 py-1.5 font-semibold rounded-lg transition-colors ${
              filterTab === 'all'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            All Roles ({roles.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('custom')}
            className={`min-h-[36px] px-3 py-1.5 font-semibold rounded-lg transition-colors ${
              filterTab === 'custom'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Custom ({roles.filter((r) => !r.is_system_role).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('system')}
            className={`min-h-[36px] px-3 py-1.5 font-semibold rounded-lg transition-colors ${
              filterTab === 'system'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            System ({roles.filter((r) => r.is_system_role).length})
          </button>
        </div>
      </div>

      {/* Role Cards List */}
      {filteredRoles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center space-y-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            No roles found for this filter.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Try switching filter tabs or create a new custom role above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoles.map((role) => {
            const permissionsList = role.permissions || [];
            const isExpanded = expandedRoleId === role.id;
            const displayPermissions = isExpanded
              ? permissionsList
              : permissionsList.slice(0, 4);

            return (
              <div
                key={role.id}
                className="flex flex-col justify-between rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-xs hover:border-gray-300 dark:hover:border-gray-700 transition-all"
              >
                <div className="space-y-3">
                  {/* Card Title & Type Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                        {role.name}
                      </h3>
                      {role.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {role.description}
                        </p>
                      )}
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        role.is_system_role
                          ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50'
                          : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50'
                      }`}
                    >
                      {role.is_system_role ? 'System Role' : 'Custom Role'}
                    </span>
                  </div>

                  {/* Permission Count Indicator */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>
                      <strong className="font-semibold text-gray-900 dark:text-gray-100">
                        {permissionsList.length}
                      </strong>{' '}
                      permissions granted
                    </span>
                  </div>

                  {/* Assigned Permission Pills */}
                  {permissionsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {displayPermissions.map((perm) => (
                        <span
                          key={perm.id || perm.name}
                          className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-300"
                        >
                          {perm.name}
                        </span>
                      ))}

                      {permissionsList.length > 4 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(role.id)}
                          className="min-h-[32px] inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {isExpanded
                            ? 'Show Less'
                            : `+${permissionsList.length - 4} more`}
                        </button>
                      )}
                    </div>
                  )}

                  {!role.is_system_role && (
                    <div className="flex gap-2 border-t border-gray-100 pt-3">
                      <button type="button" onClick={() => setEditingRoleId(editingRoleId === role.id ? null : role.id)} className="min-h-10 rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-700">
                        {editingRoleId === role.id ? 'Tutup' : 'Edit'}
                      </button>
                      <form action={deleteAction} onSubmit={(event) => { if (!window.confirm(`Hapus role ${role.name}?`)) event.preventDefault(); }}>
                        <input type="hidden" name="roleId" value={role.id} />
                        <button type="submit" className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600">Hapus</button>
                      </form>
                    </div>
                  )}

                  {editingRoleId === role.id && !role.is_system_role && (
                    <form action={updateAction} className="space-y-2 border-t border-gray-100 pt-3">
                      <input type="hidden" name="roleId" value={role.id} />
                      {permissionsList.map((permission) => <input key={permission.id} type="hidden" name="permissionIds" value={permission.id} />)}
                      <input name="name" defaultValue={role.name} className="min-h-10 w-full rounded-lg border border-gray-300 px-3 text-xs" aria-label="Nama role" />
                      <input name="description" defaultValue={role.description || ''} className="min-h-10 w-full rounded-lg border border-gray-300 px-3 text-xs" aria-label="Deskripsi role" />
                      <button type="submit" className="min-h-10 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white">Simpan role</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {(updateState.message || deleteState.message) && <p role="status" className="text-sm text-gray-600">{updateState.message || deleteState.message}</p>}
    </div>
  );
}
