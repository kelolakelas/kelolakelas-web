export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly description?: string;
}

/**
 * The single source of truth for which permission a tenant navigation item needs
 * (KEL-136). The backend stays the access authority; this map only decides what
 * the dashboard offers. `null` marks an item every member of a tenant sees
 * (Overview), so a caller cannot turn it off by passing an empty list.
 *
 * Permission names come from the identity seeder
 * (`seeders/000001_default_permissions_and_roles.sql`); do not invent new ones.
 */
export const NAV_ITEM_PERMISSIONS: Readonly<Record<string, string | null>> = {
  '/dashboard/tenant': null,
  '/dashboard/tenant/classes': 'class:read',
  '/dashboard/tenant/sessions': 'schedule:read',
  '/dashboard/tenant/enrollments': 'enrollment:read',
  '/dashboard/tenant/schedule-requests': 'enrollment:read',
  '/dashboard/tenant/vouchers': 'voucher:read',
  '/dashboard/tenant/chat': 'chat:manage',
  '/dashboard/tenant/members': 'member:read',
  '/dashboard/tenant/roles': 'role:read',
  '/dashboard/tenant/settings': 'tenant:read',
};

export const TENANT_NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Overview',
    href: '/dashboard/tenant',
    description: 'Dashboard metrics & quick actions',
  },
  {
    label: 'Classes',
    href: '/dashboard/tenant/classes',
    description: 'Manage subject categories, classes & schedules',
  },
  {
    label: 'Sesi Saya',
    href: '/dashboard/tenant/sessions',
    description: 'Lihat sesi mengajar Anda dan catat kehadiran',
  },
  {
    label: 'Enrollments',
    href: '/dashboard/tenant/enrollments',
    description: 'Monitor student enrollments and payment status',
  },
  {
    label: 'Schedule Requests',
    href: '/dashboard/tenant/schedule-requests',
    description: 'Review private schedule requests from parents',
  },
  {
    label: 'Vouchers',
    href: '/dashboard/tenant/vouchers',
    description: 'Manage discounts and voucher usage',
  },
  {
    label: 'Chat',
    href: '/dashboard/tenant/chat',
    description: 'Read and reply to conversations',
  },
  {
    label: 'Members',
    href: '/dashboard/tenant/members',
    description: 'Manage organization team members',
  },
  {
    label: 'Roles & Permissions',
    href: '/dashboard/tenant/roles',
    description: 'Configure custom roles and permission policies',
  },
  {
    label: 'Settings',
    href: '/dashboard/tenant/settings',
    description: 'Organization profile & configuration',
  },
] as const;
