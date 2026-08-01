'use client';

import { useMemo, useState } from 'react';
import type { Permission } from '../_lib/schema';

interface PermissionSelectorProps {
  permissions: Permission[];
  selectedPermissionIds: string[];
  onChange: (selectedIds: string[]) => void;
  error?: string;
}

interface PermissionGroup {
  id: string;
  title: string;
  description: string;
  permissions: Permission[];
}

/**
 * Categorizes a list of permissions into logical domain modules based on naming patterns.
 */
function groupPermissions(permissions: Permission[]): PermissionGroup[] {
  const groups: Record<string, PermissionGroup> = {
    members: {
      id: 'members',
      title: 'Team & Members',
      description: 'Manage organization team members, user accounts, and invitations.',
      permissions: [],
    },
    academic: {
      id: 'academic',
      title: 'Classes & Subjects',
      description: 'Configure academic subjects, course categories, and class offerings.',
      permissions: [],
    },
    schedules: {
      id: 'schedules',
      title: 'Schedules & Sessions',
      description: 'Oversee class timetables, session rosters, and tutor assignments.',
      permissions: [],
    },
    roles: {
      id: 'roles',
      title: 'Roles & Access Control',
      description: 'Define custom role permissions and access policies.',
      permissions: [],
    },
    settings: {
      id: 'settings',
      title: 'Organization Settings',
      description: 'Manage tenant profile, branding, and global system configuration.',
      permissions: [],
    },
    general: {
      id: 'general',
      title: 'General Operations',
      description: 'General system operations and miscellaneous capabilities.',
      permissions: [],
    },
  };

  permissions.forEach((perm) => {
    const lowerName = (perm.name || '').toLowerCase();
    const lowerDesc = (perm.description || '').toLowerCase();

    if (
      lowerName.includes('member') ||
      lowerName.includes('user') ||
      lowerName.includes('invitation') ||
      lowerDesc.includes('member') ||
      lowerDesc.includes('user')
    ) {
      groups.members.permissions.push(perm);
    } else if (
      lowerName.includes('class') ||
      lowerName.includes('category') ||
      lowerName.includes('academic') ||
      lowerName.includes('course') ||
      lowerDesc.includes('class')
    ) {
      groups.academic.permissions.push(perm);
    } else if (
      lowerName.includes('schedule') ||
      lowerName.includes('session') ||
      lowerName.includes('tutor') ||
      lowerName.includes('attendee') ||
      lowerDesc.includes('schedule')
    ) {
      groups.schedules.permissions.push(perm);
    } else if (
      lowerName.includes('role') ||
      lowerName.includes('permission') ||
      lowerDesc.includes('role')
    ) {
      groups.roles.permissions.push(perm);
    } else if (
      lowerName.includes('tenant') ||
      lowerName.includes('setting') ||
      lowerName.includes('organization') ||
      lowerDesc.includes('tenant')
    ) {
      groups.settings.permissions.push(perm);
    } else {
      groups.general.permissions.push(perm);
    }
  });

  return Object.values(groups).filter((group) => group.permissions.length > 0);
}

export function PermissionSelector({
  permissions,
  selectedPermissionIds,
  onChange,
  error,
}: PermissionSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Group permissions logically
  const groupedPermissions = useMemo(() => {
    return groupPermissions(permissions);
  }, [permissions]);

  // 2. Filter permissions based on live search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedPermissions;
    const query = searchQuery.toLowerCase().trim();

    return groupedPermissions
      .map((group) => {
        const matchingPermissions = group.permissions.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            (p.description && p.description.toLowerCase().includes(query))
        );
        return {
          ...group,
          permissions: matchingPermissions,
        };
      })
      .filter((group) => group.permissions.length > 0);
  }, [groupedPermissions, searchQuery]);

  const selectedSet = useMemo(() => new Set(selectedPermissionIds), [selectedPermissionIds]);

  // Toggle individual permission
  const handleToggle = (id: string) => {
    const nextSet = new Set(selectedSet);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    onChange(Array.from(nextSet));
  };

  // Toggle all permissions inside a specific module
  const handleToggleGroup = (groupPermissionsList: Permission[]) => {
    const groupIds = groupPermissionsList.map((p) => p.id);
    const allSelectedInGroup = groupIds.every((id) => selectedSet.has(id));

    const nextSet = new Set(selectedSet);
    if (allSelectedInGroup) {
      groupIds.forEach((id) => nextSet.delete(id));
    } else {
      groupIds.forEach((id) => nextSet.add(id));
    }
    onChange(Array.from(nextSet));
  };

  // Global Select All / Clear All
  const handleSelectAllGlobal = () => {
    onChange(permissions.map((p) => p.id));
  };

  const handleClearAllGlobal = () => {
    onChange([]);
  };

  const totalSelectedCount = selectedSet.size;
  const totalCount = permissions.length;

  return (
    <div className="space-y-4">
      {/* Hidden inputs to pass selected IDs through native FormData submission */}
      {selectedPermissionIds.map((id) => (
        <input key={id} type="hidden" name="permissionIds" value={id} />
      ))}

      {/* Header & Global Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>Assign Permissions</span>
            <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
              {totalSelectedCount} of {totalCount} selected
            </span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Select the specific module capabilities to grant to users with this role.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllGlobal}
            className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors border border-blue-200 dark:border-blue-900/50"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={handleClearAllGlobal}
            className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Search Input Filter */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter permissions by keyword (e.g. create, member, class)..."
          className="w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 pl-9 pr-8 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Permission Modules List */}
      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-8 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No permissions matching &quot;{searchQuery}&quot;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGroups.map((group) => {
            const groupSelectedCount = group.permissions.filter((p) =>
              selectedSet.has(p.id)
            ).length;
            const isAllGroupSelected =
              group.permissions.length > 0 &&
              groupSelectedCount === group.permissions.length;

            return (
              <div
                key={group.id}
                className="flex flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 p-4 shadow-xs hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                {/* Group Card Header */}
                <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
                        {group.title}
                      </h4>
                      <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                        {groupSelectedCount}/{group.permissions.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {group.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleGroup(group.permissions)}
                    className="min-h-[32px] shrink-0 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                  >
                    {isAllGroupSelected ? 'Deselect Module' : 'Select Module'}
                  </button>
                </div>

                {/* Permission Checkboxes / Touch Cards */}
                <div className="space-y-2 flex-1">
                  {group.permissions.map((perm) => {
                    const isChecked = selectedSet.has(perm.id);

                    return (
                      <label
                        key={perm.id}
                        className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border p-2.5 transition-all ${
                          isChecked
                            ? 'border-blue-500/50 bg-blue-50/50 dark:border-blue-500/40 dark:bg-blue-950/20'
                            : 'border-gray-100 dark:border-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                      >
                        <div className="flex min-h-[24px] items-center pt-0.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggle(perm.id)}
                            className="h-4 w-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:checked:bg-blue-600"
                          />
                        </div>
                        <div className="flex flex-col text-xs leading-relaxed">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {perm.name}
                          </span>
                          {perm.description && (
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {perm.description}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
