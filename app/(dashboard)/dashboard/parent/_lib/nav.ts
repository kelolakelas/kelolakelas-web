export interface ParentNavItem {
  label: string;
  href: string;
  description: string;
}

/**
 * Shared parent navigation (KEL-141). Static on purpose: every parent area
 * is reachable for every parent, so there is no permission filtering to do
 * here. The backend stays the access authority.
 */
export const PARENT_NAV_ITEMS: readonly ParentNavItem[] = [
  {
    label: 'Kelas saya',
    href: '/dashboard/parent/enrollments',
    description: 'Status enrollment dan pembayaran',
  },
  {
    label: 'Anak',
    href: '/dashboard/parent/students',
    description: 'Kelola profil anak',
  },
  {
    label: 'Jadwal & Progres',
    href: '/dashboard/parent/progress',
    description: 'Jadwal, kehadiran, dan laporan anak',
  },
  {
    label: 'Chat',
    href: '/dashboard/parent/chat',
    description: 'Percakapan dengan tenant',
  },
];
