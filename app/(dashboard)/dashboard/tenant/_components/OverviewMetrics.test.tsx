import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for the tenant overview metric cards.
 *
 * - KEL-83: the Active Roles card must open the roles page, not the members page.
 * - KEL-84: Pending Invites counts the active invitations from the invitation
 *   list (expired ones excluded) instead of members with `status: 'pending'`.
 * - KEL-171: the hardcoded "System Status" / "Operational" card is gone —
 *   service health is never measured here, so only real counts stay.
 */

const queries = vi.hoisted(() => ({
  getTenantMembers: vi.fn(),
  getTenantRoles: vi.fn(),
  getTenantInvitations: vi.fn(),
}));

vi.mock('../members/_queries/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../members/_queries/queries')>();
  return {
    ...actual,
    getTenantMembers: queries.getTenantMembers,
    getTenantRoles: queries.getTenantRoles,
    getTenantInvitations: queries.getTenantInvitations,
  };
});

const { OverviewMetrics } = await import('./OverviewMetrics');
const fullAccess = { permissions: ['member:read', 'role:read', 'tenant:read', 'member:invite'] };

function invitation(id: string, status: 'active' | 'expired') {
  return {
    id,
    email: `${id}@example.com`,
    role_id: 'role-1',
    expires_at: '2026-09-28T10:00:00Z',
    status,
    email_sent: true,
  };
}

function setDefaults() {
  queries.getTenantMembers.mockResolvedValue({
    members: [],
    pagination: { total_items: 3 },
  });
  queries.getTenantRoles.mockResolvedValue([{ id: 'role-1', name: 'Owner' }]);
  queries.getTenantInvitations.mockResolvedValue({ state: 'ok', invitations: [] });
}

function pendingInvitesCard(html: string) {
  return html.split('<a ').find((card) => card.includes('Pending Invites')) ?? '';
}

function cardValue(card: string) {
  return card.match(/text-3xl[^>]*>([^<]*)</)?.[1];
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('OverviewMetrics', () => {
  it('links the Active Roles card to the roles page', async () => {
    setDefaults();
    const html = renderToStaticMarkup(await OverviewMetrics(fullAccess));

    const activeRolesCard = html
      .split('<a ')
      .find((card) => card.includes('Active Roles'));

    expect(activeRolesCard).toContain('href="/dashboard/tenant/roles"');
  });

  it('keeps the Total Members card on the members page', async () => {
    setDefaults();
    const html = renderToStaticMarkup(await OverviewMetrics(fullAccess));

    const membersCard = html.split('<a ').find((card) => card.includes('Total Members'));

    expect(membersCard).toContain('href="/dashboard/tenant/members"');
  });

  it('counts only active invitations as Pending Invites', async () => {
    setDefaults();
    queries.getTenantInvitations.mockResolvedValue({
      state: 'ok',
      invitations: [
        invitation('a', 'active'),
        invitation('b', 'active'),
        invitation('c', 'expired'),
      ],
    });

    const card = pendingInvitesCard(renderToStaticMarkup(await OverviewMetrics(fullAccess)));

    expect(cardValue(card)).toBe('2');
  });

  it('no longer derives Pending Invites from member status', async () => {
    setDefaults();
    queries.getTenantMembers.mockResolvedValue({
      members: [
        { id: 'm1', email: 'm1@example.com', first_name: 'M', last_name: '1', status: 'pending' },
      ],
      pagination: { total_items: 1 },
    });

    const card = pendingInvitesCard(renderToStaticMarkup(await OverviewMetrics(fullAccess)));

    expect(cardValue(card)).toBe('0');
  });

  it('shows a dash instead of a count when the invitation read is forbidden or fails', async () => {
    setDefaults();
    queries.getTenantInvitations.mockResolvedValue({ state: 'forbidden' });
    expect(cardValue(pendingInvitesCard(renderToStaticMarkup(await OverviewMetrics(fullAccess))))).toBe('—');

    queries.getTenantInvitations.mockResolvedValue({ state: 'error' });
    expect(cardValue(pendingInvitesCard(renderToStaticMarkup(await OverviewMetrics(fullAccess))))).toBe('—');
  });

  it('renders only the three real count cards, never a hardcoded system status', async () => {
    setDefaults();
    const html = renderToStaticMarkup(await OverviewMetrics(fullAccess));

    expect(html).toContain('Total Members');
    expect(html).toContain('Active Roles');
    expect(html).toContain('Pending Invites');
    expect(html).not.toContain('System Status');
    expect(html).not.toContain('Operational');
    expect(html).not.toContain('Services online');
  });
});


describe('overview metric permission gating (KEL-192)', () => {
  it('does not fetch or render administration counts for a teacher', async () => {
    setDefaults();
    expect(await OverviewMetrics({ permissions: ['session:read', 'report:read'] })).toBeNull();
    for (const query of Object.values(queries)) expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['member:read', 'Total Members', 'getTenantMembers'],
    ['role:read', 'Active Roles', 'getTenantRoles'],
  ])('reads only the metric granted by %s', async (permission, title, reader) => {
    setDefaults();
    const html = renderToStaticMarkup(await OverviewMetrics({ permissions: [permission] }));
    expect(html).toContain(title);
    for (const name of ['Total Members', 'Active Roles', 'Pending Invites']) {
      if (name !== title) expect(html).not.toContain(name);
    }
    for (const [name, query] of Object.entries(queries)) {
      if (name === reader) expect(query).toHaveBeenCalledOnce();
      else expect(query).not.toHaveBeenCalled();
    }
  });

  it('hides invitation metrics without read access to their destination', async () => {
    setDefaults();
    expect(await OverviewMetrics({ permissions: ['member:invite'] })).toBeNull();
    expect(queries.getTenantInvitations).not.toHaveBeenCalled();
  });
});
