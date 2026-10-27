import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const { readRequests } = vi.hoisted(() => ({ readRequests: vi.fn() }));
vi.mock('@/lib/creator-requests', () => ({ readCreatorRequests: readRequests }));
vi.mock('./_queries/membership', () => ({ readTenantNav: async () => ({ items: [], roleName: 'Creator', state: 'ok' }) }));
vi.mock('./_components/MobileNav', () => ({ MobileNav: () => null }));
vi.mock('./_components/TenantSidebar', () => ({ TenantSidebar: () => null }));
vi.mock('@/lib/chat-unread-scope', () => ({ readChatUnreadScope: async () => 'scope' }));
vi.mock('@/lib/tenant-session-actions', () => ({ readTenantChoices: async () => ({ choices: [], activeTenant: '', error: false }) }));
vi.mock('@/components/TenantContextBoundary', () => ({ TenantContextBoundary: ({ children }: { children: import('react').ReactNode }) => children }));
vi.mock('@/components/chat/ChatUnreadProvider', () => ({ ChatUnreadProvider: ({children}: {children: import('react').ReactNode}) => children }));
import Layout from './layout';

it.each(['Classes', 'Chat', 'Overview'])('keeps %s free of the global request entry and read', async name => {
  const html = renderToStaticMarkup(await Layout({ children: <h1>{name}</h1> }));
  expect(html).toContain(name);
  expect(html).not.toContain('creator-requests');
  expect(html).not.toContain('Owner Account Request');
  expect(readRequests).not.toHaveBeenCalled();
});
