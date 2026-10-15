import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MINIMUM_SAFE_NAV_ITEMS } from './_lib/nav';
import { readTenantNav, type TenantNavRead } from './_queries/membership';

/**
 * Render test for the tenant overview screen (KEL-171).
 *
 * The page is a Server Component, so the membership query and the async
 * metric/sales cards are mocked and the rendered markup is asserted. What
 * matters for the acceptance criteria: the greeting follows the caller's own
 * role (Owner, Teacher) instead of the static "Tenant Admin" label, an
 * unreadable membership falls back to a neutral greeting rather than
 * claiming a role, and no hardcoded system status, architecture panel, or
 * API-keys copy is rendered.
 */

vi.mock('./_queries/membership', () => ({
  readTenantNav: vi.fn(),
}));
vi.mock('./_components/OverviewMetrics', () => ({
  OverviewMetrics: () => <div data-testid="metrics-stub" />,
}));
vi.mock('./_components/SalesSummaryCard', () => ({
  SalesSummaryCard: () => <div data-testid="sales-stub" />,
  SalesSummarySkeleton: () => <div data-testid="sales-skeleton-stub" />,
}));

const { default: TenantOverviewPage } = await import('./page');

const mockedReadTenantNav = vi.mocked(readTenantNav);

function okNav(roleName: string, permissions = roleName === 'Owner' ? ['member:read', 'role:read', 'tenant:read', 'member:invite'] : []): TenantNavRead {
  return {
    state: 'ok',
    items: MINIMUM_SAFE_NAV_ITEMS,
    roleName,
    membership: { member_id: 'member-1', role_id: 'role-1', role_name: roleName, permissions },
  };
}

function failedNav(): Exclude<TenantNavRead, { state: 'ok' }> {
  return { state: 'api', items: MINIMUM_SAFE_NAV_ITEMS, roleName: null, membership: null };
}

const FORBIDDEN_STRINGS = [
  'Welcome back, Tenant Admin',
  'System Status',
  'Operational',
  'Platform Architecture',
  'API keys',
  'Tenant Member',
];

async function render(): Promise<string> {
  return renderToStaticMarkup(await TenantOverviewPage());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tenant overview greeting (KEL-171)', () => {
  it('greets an Owner by role instead of the static Tenant Admin label', async () => {
    mockedReadTenantNav.mockResolvedValue(okNav('Owner'));

    const html = await render();

    expect(html).toContain('>Welcome back, Owner<');
    expect(html).not.toContain('Welcome back, Tenant Admin');
  });

  it('greets a Teacher by role', async () => {
    mockedReadTenantNav.mockResolvedValue(okNav('Teacher'));

    const html = await render();

    expect(html).toContain('>Welcome back, Teacher<');
    expect(html).not.toContain('Welcome back, Tenant Admin');
  });

  it('falls back to a neutral greeting when the membership cannot be read', async () => {
    mockedReadTenantNav.mockResolvedValue(failedNav());

    const html = await render();

    expect(html).toContain('>Welcome back<');
    expect(html).not.toContain('Welcome back, Tenant Admin');
    expect(html).not.toContain('Welcome back, null');
  });

  it('shows no hardcoded system status, architecture panel, or API-keys copy', async () => {
    mockedReadTenantNav.mockResolvedValue(okNav('Owner'));

    const html = await render();

    for (const forbidden of FORBIDDEN_STRINGS) {
      expect(html).not.toContain(forbidden);
    }
  });

  it('keeps the management shortcuts and the metrics/sales regions', async () => {
    mockedReadTenantNav.mockResolvedValue(okNav('Owner'));

    const html = await render();

    expect(html).toContain('Organization Management');
    expect(html).toContain('Member Directory');
    expect(html).toContain('Tenant Settings');
    expect(html).toContain('data-testid="metrics-stub"');
    expect(html).toContain('data-testid="sales-stub"');
  });
});


describe('overview administrative offers (KEL-192)', () => {
  it('shows the complete overview for an owner with all permissions', async () => {
    mockedReadTenantNav.mockResolvedValue(okNav('Owner'));
    const html = await render();
    expect(html).toContain('Invite Member');
    expect(html).toContain('Member Directory');
    expect(html).toContain('Tenant Settings');
    expect(html).toContain('metrics-stub');
  });

  it.each(['Teacher', 'Owner'])('uses grants rather than the %s role name', async (role) => {
    mockedReadTenantNav.mockResolvedValue(okNav(role, []));
    const html = await render();
    for (const text of ['Invite Member', 'Member Directory', 'Tenant Settings', 'Organization Management', 'metrics-stub']) expect(html).not.toContain(text);
    expect(html).toContain('sales-stub');
  });

  it.each(['api', 'forbidden', 'configuration'] as const)('stays neutral when membership is %s', async (state) => {
    mockedReadTenantNav.mockResolvedValue({ ...failedNav(), state });
    const html = await render();
    for (const text of ['Invite Member', 'Member Directory', 'Tenant Settings', 'metrics-stub']) expect(html).not.toContain(text);
    expect(html).toContain('>Welcome back<');
    expect(html).toContain('sales-stub');
  });

  it('offers only members to a custom role with member read access', async () => {
    mockedReadTenantNav.mockResolvedValue(okNav('Custom', ['member:read']));
    const html = await render();
    expect(html).toContain('Member Directory');
    expect(html).toContain('View team members');
    expect(html).not.toContain('Invite Member');
    expect(html).not.toContain('Tenant Settings');
  });

  it('offers only settings to a custom role with tenant read access', async () => {
    mockedReadTenantNav.mockResolvedValue(okNav('Custom', ['tenant:read']));
    const html = await render();
    expect(html).toContain('Tenant Settings');
    expect(html).not.toContain('Member Directory');
    expect(html).not.toContain('Invite Member');
    expect(html).not.toContain('metrics-stub');
  });

  it('removes offers on the next read after permission revocation', async () => {
    mockedReadTenantNav.mockResolvedValueOnce(okNav('Owner')).mockResolvedValueOnce(okNav('Owner', []));
    expect(await render()).toContain('Invite Member');
    expect(await render()).not.toContain('Member Directory');
  });
});
