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
    label: 'Sessions',
    href: '/dashboard/tenant/sessions',
    description: 'Monitor session attendees and schedule changes',
  },
  {
    label: 'Enrollments',
    href: '/dashboard/tenant/enrollments',
    description: 'Enroll a real student into a class',
  },
  { label: 'Students', href: '/dashboard/tenant/students', description: 'Manage students' },
  { label: 'Attendance', href: '/dashboard/tenant/attendance', description: 'Record attendance' },
  { label: 'Reports', href: '/dashboard/tenant/reports', description: 'Manage learning reports' },
  {
    label: 'Billing',
    href: '/dashboard/tenant/billing',
    description: 'Create a payment checkout session',
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
