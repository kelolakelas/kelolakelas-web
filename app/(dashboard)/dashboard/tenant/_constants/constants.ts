export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly description?: string;
}

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
    label: 'Enrollments',
    href: '/dashboard/tenant/enrollments',
    description: 'Monitor student enrollments and payment status',
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
