import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * Regression test for the tenant overview metric links (KEL-83): the Active
 * Roles card must open the roles page, not the members page.
 */

vi.mock('../members/_queries/queries', () => ({
  getTenantMembers: vi.fn(async () => ({
    members: [],
    pagination: { total_items: 3 },
  })),
  getTenantRoles: vi.fn(async () => [{ id: 'role-1', name: 'Owner' }]),
}));

const { OverviewMetrics } = await import('./OverviewMetrics');

describe('OverviewMetrics', () => {
  it('links the Active Roles card to the roles page', async () => {
    const html = renderToStaticMarkup(await OverviewMetrics());

    const activeRolesCard = html
      .split('<a ')
      .find((card) => card.includes('Active Roles'));

    expect(activeRolesCard).toContain('href="/dashboard/tenant/roles"');
  });

  it('keeps the Total Members card on the members page', async () => {
    const html = renderToStaticMarkup(await OverviewMetrics());

    const membersCard = html.split('<a ').find((card) => card.includes('Total Members'));

    expect(membersCard).toContain('href="/dashboard/tenant/members"');
  });
});
