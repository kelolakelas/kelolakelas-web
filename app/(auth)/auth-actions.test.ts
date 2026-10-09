import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginAction } from './login/_actions/actions';
import { registerParent, registerTenant } from './register/_actions/actions';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), set: vi.fn(), redirect: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/gateway', () => ({
  getGatewayBaseUrl: () => 'http://gateway.test',
  withGatewayClientIp: async (headers: unknown) => headers,
  getGatewayConfigurationErrorMessage: () => null,
}));
const initial = { success: false, message: '' };
const common = { first_name: ' Jane ', last_name: 'Doe', email: 'jane@example.com', phone: '08123' };
const tenant = { ...common, tenant_name: 'Academy', tenant_phone: '02123', tenant_address: 'Main Street' };
const cases = [
  ['login', loginAction, { email: common.email }, '/api/v1/auth/login'],
  ['parent', registerParent, common, '/api/v1/auth/register'],
  ['tenant', registerTenant, tenant, '/api/v1/tenants/register'],
] as const;
function data(values: Record<string, string>, password = 'valid-secret') {
  const form = new FormData();
  for (const [key, value] of Object.entries({ ...values, password, unexpected: 'not-returned' })) form.set(key, value);
  return form;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe.each(cases)('%s action', (_name, action, values, endpoint) => {
  it('returns only allowlisted strings on validation failure, without password', async () => {
    const result = await action(initial, data(values, 'x'));
    expect(result.success).toBe(false);
    expect(result.errors?.password).toBeDefined();
    expect(result.values).toEqual(values);
    expect(JSON.stringify(result)).not.toContain('valid-secret');
    expect(result.values).not.toHaveProperty('password');
    expect(result.values).not.toHaveProperty('unexpected');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([401, 409, 500])('retains values on backend rejection %s', async status => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ status: 'error', message: 'Rejected' }), { status }));
    const result = await action(initial, data(values));
    expect(result).toEqual({ success: false, message: 'Rejected', values });
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it('retains values on connection failure and malformed backend JSON', async () => {
    for (const failure of ['network', 'json']) {
      if (failure === 'network') mocks.fetch.mockRejectedValue(new Error('offline'));
      else mocks.fetch.mockResolvedValue(new Response('invalid-json'));
      const result = await action(initial, data(values));
      expect(result.values).toEqual(values);
      expect(result.success).toBe(false);
      expect(JSON.stringify(result)).not.toContain('valid-secret');
    }
  });
  it('does not serialize files as input values', async () => {
    const form = data(values, 'x');
    form.set('email', new Blob(['not-text']), 'email.txt');
    const result = await action(initial, form);
    expect(result.values?.email).toBe('');
    expect(result.errors?.email).toBeDefined();
  });
  it('keeps endpoint, successful cookie and redirect behavior', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ status: 'success', data: { token: 'test-token', tenant_id: 'tenant-test', user: { is_parent: true } } })));
    const result = await action(initial, data(values));
    expect(mocks.fetch.mock.calls[0][0]).toBe(`http://gateway.test${endpoint}`);
    if (_name === 'login') {
      expect(mocks.redirect).toHaveBeenCalledWith('/kelas');
    } else {
      expect(result).toMatchObject({ success: true, redirectTo: _name === 'parent' ? '/login?registered=1' : '/dashboard/tenant' });
      expect(result).not.toHaveProperty('values');
    }
    if (_name !== 'parent') expect(mocks.set).toHaveBeenCalledWith('auth_token', 'test-token', expect.objectContaining({ httpOnly: true }));
  });
});
