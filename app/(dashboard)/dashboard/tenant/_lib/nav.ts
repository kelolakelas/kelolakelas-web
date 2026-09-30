import { NAV_ITEM_PERMISSIONS, TENANT_NAV_ITEMS, type NavItem } from '../_constants/constants';

/**
 * Role-aware tenant navigation (KEL-136).
 *
 * The backend remains the access authority; this module only decides which menu
 * items the dashboard offers. When the membership cannot be read, callers get the
 * minimum safe menu (Overview only) plus an error message — never the full admin
 * menu.
 */

/** The items every tenant member sees regardless of permissions. */
export const MINIMUM_SAFE_NAV_ITEMS: readonly NavItem[] = TENANT_NAV_ITEMS.filter(
  (item) => NAV_ITEM_PERMISSIONS[item.href] === null
);

/**
 * Decides which navigation items a member with these permissions may see.
 *
 * Items without a permission requirement (Overview) are always visible. An item
 * whose permission is not granted is hidden, not disabled: the member cannot
 * reach the area anyway and a greyed-out admin menu would leak its existence.
 */
export function filterTenantNavItems(permissions: readonly string[] | null | undefined): readonly NavItem[] {
  const granted = new Set(permissions ?? []);
  return TENANT_NAV_ITEMS.filter((item) => {
    const required = NAV_ITEM_PERMISSIONS[item.href];
    return required === null || required === undefined || granted.has(required);
  });
}

export const TENANT_NAV_ERROR_MESSAGE =
  'Menu belum dapat dimuat sesuai permission Anda. Beberapa menu mungkin tidak tampil. Coba muat ulang halaman.';
