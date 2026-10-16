import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const { nav, members, roles, requests } = vi.hoisted(() => ({ nav: vi.fn(), members: vi.fn(), roles: vi.fn(), requests: vi.fn() }));
vi.mock('../_queries/membership', () => ({ readTenantNav: nav }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('./_queries/queries', () => ({ getTenantMembers: members, getTenantRoles: roles, getTenantInvitations: async () => ({}) }));
vi.mock('./_components/OwnerAccountRequests', () => ({ OwnerAccountRequests: requests }));
vi.mock('./_components/InviteMemberModal', () => ({ InviteMemberModal: () => null }));
vi.mock('./_components/MembersTable', () => ({ MembersTable: () => null }));
vi.mock('./_components/PendingInvitations', () => ({ PendingInvitations: () => null, PendingInvitationsSkeleton: () => null }));
import Page from './page';

async function resolve(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(Children.toArray(node).map(resolve));
  if (!isValidElement<{ children?: ReactNode }>(node)) return node;
  if (typeof node.type === 'function') {
    const component = node.type as (props: unknown) => ReactNode | Promise<ReactNode>;
    return resolve(await component(node.props));
  }
  if (typeof node.type === 'symbol') return resolve(node.props.children);
  return { ...node, props: { ...node.props, children: await resolve(node.props.children) } } as ReactElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  members.mockResolvedValue({ members: [], pagination: { total_pages: 0 } });
  roles.mockResolvedValue([]);
  requests.mockResolvedValue(<section key="owner-request">Owner Account Request</section>);
});

it('includes the request flow in authorized Members content', async () => {
  nav.mockResolvedValue({ state: 'ok', membership: { permissions: ['member:read'] } });
  const html = renderToStaticMarkup(await resolve(Page({ searchParams: Promise.resolve({}) })));
  expect(html).toContain('Owner Account Request');
  expect(requests).toHaveBeenCalledOnce();
  expect(roles).not.toHaveBeenCalled();
});

it('denies Members before starting protected request or member reads', async () => {
  nav.mockResolvedValue({ state: 'ok', membership: { permissions: [] } });
  const html = renderToStaticMarkup(await resolve(Page({ searchParams: Promise.resolve({}) })));
  expect(html).toContain('Akses ditolak');
  expect(requests).not.toHaveBeenCalled();
  expect(members).not.toHaveBeenCalled();
});
