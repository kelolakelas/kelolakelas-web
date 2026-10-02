import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MINIMUM_SAFE_NAV_ITEMS,
  TENANT_NAV_ERROR_MESSAGE,
  filterTenantNavItems,
} from './nav';

/**
 * KEL-136 menu filtering.
 *
 * Teacher (schedule/attendance/student_note/report) must not see Members,
 * Roles & Permissions, or Settings. Creator sees everything as before. A
 * failed read never renders the full admin menu: it falls back to the minimum
 * safe menu (Overview only).
 */

// All documented permission names the identity seeder grants.
const CREATOR_PERMISSIONS = [
  'tenant:read',
  'tenant:update',
  'member:invite',
  'member:read',
  'member:update',
  'member:delete',
  'role:create',
  'role:read',
  'role:update',
  'role:delete',
  'category:create',
  'category:read',
  'category:update',
  'category:delete',
  'class:create',
  'class:read',
  'class:update',
  'class:delete',
  'schedule:create',
  'schedule:read',
  'schedule:update',
  'schedule:delete',
  'student:create',
  'student:read',
  'student:update',
  'student:delete',
  'enrollment:create',
  'enrollment:read',
  'enrollment:update',
  'enrollment:delete',
  'attendance:create',
  'attendance:read',
  'attendance:update',
  'student_note:create',
  'student_note:read',
  'student_note:update',
  'student_note:delete',
  'report:create',
  'report:read',
  'report:update',
  'report:delete',
  'billing:read',
  'billing:withdraw',
  'chat:manage',
  'voucher:create',
  'voucher:read',
  'voucher:update',
  'voucher:delete',
];

// The identity seeder grants split_part(name, ':', 1) IN ('schedule', 'attendance',
// 'student_note', 'report') to the Teacher system role.
const TEACHER_PERMISSIONS = [
  'schedule:create',
  'schedule:read',
  'schedule:update',
  'schedule:delete',
  'attendance:create',
  'attendance:read',
  'attendance:update',
  'student_note:create',
  'student_note:read',
  'student_note:update',
  'student_note:delete',
  'report:create',
  'report:read',
  'report:update',
  'report:delete',
];

function labels(items: readonly { label: string }[]): string[] {
  return items.map((item) => item.label);
}

describe('filterTenantNavItems (KEL-136)', () => {
  it('shows the full menu to Creator as before', () => {
    expect(labels(filterTenantNavItems(CREATOR_PERMISSIONS))).toEqual([
      'Overview',
      'Classes',
      'Sesi Saya',
      'Enrollments',
      'Schedule Requests',
      'Vouchers',
      'Keuangan',
      'Chat',
      'Members',
      'Roles & Permissions',
      'Settings',
    ]);
  });

  it('shows Overview and Sesi Saya to Teacher', () => {
    // The seeder grants the Teacher system role only schedule/attendance/
    // student_note/report permissions. KEL-137 offers the tutor session
    // screen behind `schedule:read`, so a Teacher sees it alongside
    // Overview — but still not Members, Roles & Permissions, or Settings.
    // The backend still enforces every area.
    const visible = labels(filterTenantNavItems(TEACHER_PERMISSIONS));

    expect(visible).toEqual(['Overview', 'Sesi Saya']);
    expect(visible).not.toContain('Members');
    expect(visible).not.toContain('Roles & Permissions');
    expect(visible).not.toContain('Settings');
  });

  it('renders only Overview for a custom role with no permissions', () => {
    expect(labels(filterTenantNavItems([]))).toEqual(['Overview']);
  });

  it('renders only Overview when no permissions were read at all', () => {
    for (const permissions of [null, undefined] as const) {
      expect(labels(filterTenantNavItems(permissions))).toEqual(['Overview']);
    }
  });

  it('keeps Overview visible even for an unknown permission set', () => {
    expect(labels(filterTenantNavItems(['billing:read']))).toEqual(['Overview', 'Keuangan']);
    expect(labels(filterTenantNavItems(['billing:withdraw']))).toEqual(['Overview']);
  });
});

describe('MINIMUM_SAFE_NAV_ITEMS (KEL-136 error fallback)', () => {
  it('contains only Overview', () => {
    expect(labels(MINIMUM_SAFE_NAV_ITEMS)).toEqual(['Overview']);
  });

  it('offers an explanatory error message for the nav error state', () => {
    expect(TENANT_NAV_ERROR_MESSAGE.length).toBeGreaterThan(0);
  });
});

describe('filterTenantNavItems purity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not mutate the input or the shared item list', () => {
    const permissions = ['member:read'];
    const snapshot = [...permissions];

    filterTenantNavItems(permissions);

    expect(permissions).toEqual(snapshot);
  });
});
