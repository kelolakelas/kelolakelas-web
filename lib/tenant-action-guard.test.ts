// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}'))); });
afterEach(() => vi.unstubAllGlobals());
it('binds tenant server actions to the original document scope until full navigation', async () => {
  const original = window.fetch;
  const { installTenantActionGuard } = await import('./tenant-action-guard');
  expect(installTenantActionGuard('old-scope')).toBe(true);
  expect(installTenantActionGuard('new-scope')).toBe(false);
  await window.fetch('/dashboard/tenant/classes', { method: 'POST', headers: { 'Next-Action': 'action-id' }, body: 'draft' });
  expect(new Headers(vi.mocked(original).mock.calls[0][1]?.headers).get('X-Tenant-UI-Scope')).toBe('old-scope');
  await window.fetch('/login', { method: 'POST', headers: { 'Next-Action': 'login-id' } });
  expect(new Headers(vi.mocked(original).mock.calls[1][1]?.headers).has('X-Tenant-UI-Scope')).toBe(false);
});
