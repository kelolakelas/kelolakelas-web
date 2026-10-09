// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TENANT_NAV_ERROR_MESSAGE } from '../_lib/nav';

/**
 * Behaviour test for the mobile navigation footer (KEL-171).
 *
 * The footer lives inside the slide-out drawer, so the drawer is opened
 * first. What matters is the regression: the static "Tenant Member"
 * subtitle is gone, the role still renders (with the 'Tenant' fallback when
 * unreadable), and the nav error hint from KEL-136 still appears on a
 * failed read.
 */

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/tenant' }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/app/(auth)/logout/_components/LogoutButton', () => ({
  LogoutButton: () => <button type="submit">Keluar</button>,
}));

const { MobileNav } = await import('./MobileNav');

const ITEMS = [
  { label: 'Overview', href: '/dashboard/tenant' },
  { label: 'Members', href: '/dashboard/tenant/members' },
] as const;

function openDrawer(roleName: string | null, hasNavError: boolean) {
  render(<MobileNav items={ITEMS} roleName={roleName} hasNavError={hasNavError} />);
  fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation menu' }));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MobileNav footer (KEL-171)', () => {
  it('shows the role name without the static Tenant Member subtitle', () => {
    openDrawer('Owner', false);

    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.queryByText('Tenant Member')).toBeNull();
  });

  it('falls back to Tenant and keeps the error hint when the role cannot be read', () => {
    openDrawer(null, true);

    expect(screen.getByText('Tenant')).toBeTruthy();
    expect(screen.queryByText('Tenant Member')).toBeNull();
    expect(screen.getByText(TENANT_NAV_ERROR_MESSAGE)).toBeTruthy();
  });
});
