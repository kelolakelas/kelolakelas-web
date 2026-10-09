import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TENANT_NAV_ERROR_MESSAGE } from '../_lib/nav';

/**
 * Render test for the tenant sidebar footer (KEL-171).
 *
 * The footer already shows the caller's own role name; what matters here is
 * the regression: the static "Tenant Member" subtitle is gone, the role
 * still renders (with the 'Tenant' fallback when unreadable), and the nav
 * error hint from KEL-136 still appears on a failed read.
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

const { TenantSidebar: Sidebar } = await import('./TenantSidebar');

const ITEMS = [
  { label: 'Overview', href: '/dashboard/tenant' },
  { label: 'Members', href: '/dashboard/tenant/members' },
] as const;

function render(roleName: string | null, hasNavError: boolean): string {
  return renderToStaticMarkup(
    <Sidebar items={ITEMS} roleName={roleName} hasNavError={hasNavError} />
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('TenantSidebar footer (KEL-171)', () => {
  it('shows the role name without the static Tenant Member subtitle', () => {
    const html = render('Owner', false);

    expect(html).toContain('Owner');
    expect(html).not.toContain('Tenant Member');
  });

  it('falls back to Tenant when the role cannot be read', () => {
    const html = render(null, true);

    expect(html).toContain('Tenant');
    expect(html).not.toContain('Tenant Member');
    expect(html).toContain(TENANT_NAV_ERROR_MESSAGE);
  });

  it('shows no error hint on a healthy read', () => {
    const html = render('Teacher', false);

    expect(html).toContain('Teacher');
    expect(html).not.toContain(TENANT_NAV_ERROR_MESSAGE);
  });
});
