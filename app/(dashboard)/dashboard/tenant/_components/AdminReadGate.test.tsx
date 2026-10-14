import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readTenantNav } from '../_queries/membership';
import { AdminReadGate } from './AdminReadGate';
vi.mock('../_queries/membership', () => ({ readTenantNav: vi.fn() }));
describe('AdminReadGate', () => {
  it.each(['member:read', 'role:read', 'tenant:read'])('requires %s explicitly', async (permission) => {
    vi.mocked(readTenantNav).mockResolvedValue({ state: 'ok', items: [], roleName: 'Teacher', membership: { member_id: 'm', role_id: 'r', role_name: 'Teacher', permissions: [] } });
    expect(renderToStaticMarkup(await AdminReadGate({ permission, children: 'protected' }))).toContain('Akses ditolak');
    vi.mocked(readTenantNav).mockResolvedValue({ state: 'ok', items: [], roleName: 'Custom', membership: { member_id: 'm', role_id: 'r', role_name: 'Custom', permissions: [permission] } });
    expect(await AdminReadGate({ permission, children: 'protected' })).toBe('protected');
  });
  it.each(['forbidden', 'api', 'configuration'] as const)('fails closed on %s', async (state) => {
    vi.mocked(readTenantNav).mockResolvedValue({ state, items: [], roleName: null, membership: null });
    expect(renderToStaticMarkup(await AdminReadGate({ permission: 'member:read', children: 'protected' }))).not.toContain('protected');
  });
});
