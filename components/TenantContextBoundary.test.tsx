// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useEffect, useState } from 'react';
vi.mock('@/lib/tenant-context-events', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/tenant-context-events')>(), readBrowserTenantScope: vi.fn() }));
vi.mock('@/lib/tenant-action-guard', () => ({ installTenantActionGuard: () => true }));
import { TenantContextBoundary } from './TenantContextBoundary';
import { publishContext, TENANT_CONTEXT_KEY, readBrowserTenantScope } from '@/lib/tenant-context-events';
const closed = vi.fn();
let finish: (data: string) => void;
function ScopedData() {
  const [data, setData] = useState('Tenant A data');
  useEffect(() => { let stopped = false; void new Promise<string>(resolve => { finish = resolve; }).then(value => { if (!stopped) setData(value); }); return () => { stopped = true; closed(); }; }, []);
  return <p>{data}</p>;
}
beforeEach(() => {
  vi.resetAllMocks();
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => data.set(key, value) });
  vi.mocked(readBrowserTenantScope).mockResolvedValue('a');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('unmounts all data and connections on switch before delayed old responses resolve', async () => {
  render(<TenantContextBoundary scope="a"><ScopedData /></TenantContextBoundary>);
  expect(await screen.findByText('Tenant A data')).toBeTruthy();
  await act(async () => publishContext({ phase: 'switching', scope: 'a' }));
  expect(screen.queryByText('Tenant A data')).toBeNull(); expect(closed).toHaveBeenCalledOnce();
  await act(async () => finish('Old tenant delayed response'));
  expect(screen.queryByText('Old tenant delayed response')).toBeNull();
});
it('applies a cross-tab switch event and closes the old subtree', async () => {
  render(<TenantContextBoundary scope="a"><ScopedData /></TenantContextBoundary>);
  await screen.findByText('Tenant A data');
  await act(async () => {
    window.localStorage.setItem(TENANT_CONTEXT_KEY, JSON.stringify({ phase: 'switching', scope: 'a' }));
    window.dispatchEvent(new StorageEvent('storage', { key: TENANT_CONTEXT_KEY }));
  });
  expect(screen.queryByText('Tenant A data')).toBeNull(); expect(closed).toHaveBeenCalledOnce();
});
it('reconciles a stale storage marker after a new login without a reload loop', async () => {
  window.localStorage.setItem(TENANT_CONTEXT_KEY, JSON.stringify({ phase: 'ready', scope: 'previous-login' }));
  render(<TenantContextBoundary scope="a"><p>Current login data</p></TenantContextBoundary>);
  expect(await screen.findByText('Current login data')).toBeTruthy();
  expect(JSON.parse(window.localStorage.getItem(TENANT_CONTEXT_KEY)!)).toEqual({ phase: 'ready', scope: 'a' });
});
