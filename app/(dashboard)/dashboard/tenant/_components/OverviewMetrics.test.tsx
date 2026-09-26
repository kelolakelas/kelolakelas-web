import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for the tenant overview metric cards.
 *
 * - KEL-83: the Active Roles card must open the roles page, not the members page.
 * - KEL-84: Pending Invites counts the active invitations from the invitation
 *   list (expired ones excluded) instead of members with `status: 'pending'`.
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
    const html = renderToStaticMarkup(await OverviewMetrics());

    const activeRolesCard = html
      .split('<a ')
      .find((card) => card.includes('Active Roles'));

    expect(activeRolesCard).toContain('href="/dashboard/tenant/roles"');
  });

  it('keeps the Total Members card on the members page', async () => {
    setDefaults();
    const html = renderToStaticMarkup(await OverviewMetrics());

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

    const card = pendingInvitesCard(renderToStaticMarkup(await OverviewMetrics()));

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

    const card = pendingInvitesCard(renderToStaticMarkup(await OverviewMetrics()));

    expect(cardValue(card)).toBe('0');
  });

  it('shows a dash instead of a count when the invitation read is forbidden or fails', async () => {
    setDefaults();
    queries.getTenantInvitations.mockResolvedValue({ state: 'forbidden' });
    expect(cardValue(pendingInvitesCard(renderToStaticMarkup(await OverviewMetrics())))).toBe('—');

    queries.getTenantInvitations.mockResolvedValue({ state: 'error' });
    expect(cardValue(pendingInvitesCard(renderToStaticMarkup(await OverviewMetrics())))).toBe('—');
  });
});
