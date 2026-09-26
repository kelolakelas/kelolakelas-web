import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestHeaders = vi.hoisted(() => vi.fn());
vi.mock('next/headers', () => ({ headers: requestHeaders, cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('REDIRECT'); }) }));

const { withGatewayClientIp } = await import('./gateway');
const { getCatalog, getCatalogClass } = await import('./catalog');
const { loginAction } = await import('../app/(auth)/login/_actions/actions');
const { registerParent, registerTenant } = await import('../app/(auth)/register/_actions/actions');
const { registerInvitedUser } = await import('../app/(auth)/invitations/verify/_actions/actions');
const { enrollInClass } = await import('../app/(public)/kelas/[id]/_actions/actions');
const { cookies } = await import('next/headers');

const savedSource = process.env.CLIENT_IP_SOURCE_HEADER;
const savedGateway = process.env.GATEWAY_API_URL;
const token = `header.${Buffer.from(JSON.stringify({ user_id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11', is_parent: true })).toString('base64url')}.signature`;
const id = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
let incoming = new Headers();
let fetchMock: ReturnType<typeof vi.fn>;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const credentials = { email: 'person@example.test', password: 'password1' };
const person = { ...credentials, first_name: 'One', last_name: 'Two' };

beforeEach(() => {
  delete process.env.CLIENT_IP_SOURCE_HEADER;
  process.env.GATEWAY_API_URL = 'http://gateway.test';
  incoming = new Headers();
  requestHeaders.mockReset().mockImplementation(async () => incoming);
  vi.mocked(cookies).mockReset().mockResolvedValue({ get: () => ({ value: token }) } as never);
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'error', message: 'refused' }), { status: 429 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  if (savedSource === undefined) delete process.env.CLIENT_IP_SOURCE_HEADER;
  else process.env.CLIENT_IP_SOURCE_HEADER = savedSource;
  if (savedGateway === undefined) delete process.env.GATEWAY_API_URL;
  else process.env.GATEWAY_API_URL = savedGateway;
  vi.unstubAllGlobals();
});

function sentHeaders() {
  return fetchMock.mock.lastCall?.[1].headers as Record<string, string>;
}

describe('withGatewayClientIp', () => {
  it('leaves outbound headers untouched by default without accessing request scope', async () => {
    const original = { Accept: 'application/json' };
    expect(await withGatewayClientIp(original)).toBe(original);
    expect(requestHeaders).not.toHaveBeenCalled();
  });

  it('uses only the configured source, including IPv6 and IPv4-mapped IPv6', async () => {
    process.env.CLIENT_IP_SOURCE_HEADER = 'X-Real-IP';
    incoming.set('X-Forwarded-For', '192.0.2.99');
    for (const ip of ['198.51.100.9', '2001:db8::1', '::ffff:192.0.2.1']) {
      incoming.set('X-Real-IP', ip);
      expect(await withGatewayClientIp({ Accept: 'application/json' })).toEqual({ Accept: 'application/json', 'X-Forwarded-For': ip });
    }
  });

  it.each(['not-an-ip', '198.51.100.1, 198.51.100.2', '192.0.2.1:4000', '[2001:db8::1]', ''])('rejects invalid or chained source %j', async (ip) => {
    process.env.CLIENT_IP_SOURCE_HEADER = 'X-Real-IP';
    incoming.set('X-Real-IP', ip);
    incoming.set('X-Forwarded-For', '203.0.113.6');
    expect(await withGatewayClientIp({ Accept: 'application/json' })).toEqual({ Accept: 'application/json' });
  });

  it('does not fail in a requestless render or with invalid header configuration', async () => {
    process.env.CLIENT_IP_SOURCE_HEADER = 'X-Real-IP';
    requestHeaders.mockRejectedValueOnce(new Error('no request scope'));
    expect(await withGatewayClientIp({ Accept: 'application/json' })).toEqual({ Accept: 'application/json' });
    process.env.CLIENT_IP_SOURCE_HEADER = 'X-Real-IP, X-Forwarded-For';
    expect(await withGatewayClientIp({ Accept: 'application/json' })).toEqual({ Accept: 'application/json' });
  });
});

describe('rate-limited gateway calls', () => {
  it('forwards configured IP on login, and preserves its JSON headers', async () => {
    process.env.CLIENT_IP_SOURCE_HEADER = 'X-Real-IP';
    incoming.set('X-Real-IP', '198.51.100.10');
    incoming.set('X-Forwarded-For', '203.0.113.77');
    await loginAction({ success: false, message: '' }, form(credentials));
    expect(fetchMock.mock.lastCall?.[0]).toBe('http://gateway.test/api/v1/auth/login');
    expect(sentHeaders()).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json', 'X-Forwarded-For': '198.51.100.10' });
  });

  it('does not forward any IP by default on login, even when the incoming request has one', async () => {
    incoming.set('X-Forwarded-For', '203.0.113.77');
    await loginAction({ success: false, message: '' }, form(credentials));
    expect(sentHeaders()).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(requestHeaders).not.toHaveBeenCalled();
  });

  it('does not forward invalid IP on login', async () => {
    process.env.CLIENT_IP_SOURCE_HEADER = 'X-Real-IP';
    incoming.set('X-Real-IP', '198.51.100.1, 198.51.100.2');
    await loginAction({ success: false, message: '' }, form(credentials));
    expect(sentHeaders()).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json' });
  });

  it.each([
    ['parent registration', () => registerParent({ success: false, message: '' }, form(person)), '/api/v1/auth/register'],
    ['tenant registration', () => registerTenant({ success: false, message: '' }, form({ ...person, tenant_name: 'School' })), '/api/v1/tenants/register'],
    ['invitation acceptance', () => registerInvitedUser({ success: false, message: '' }, form({ token: 'invite-token', first_name: 'One', last_name: 'Two', password: 'password1' })), '/api/v1/invitations/register'],
  ])('forwards IP on %s', async (_, action, path) => {
    process.env.CLIENT_IP_SOURCE_HEADER = 'X-Real-IP';
    incoming.set('X-Real-IP', '2001:db8::7');
    await action();
    expect(fetchMock.mock.lastCall?.[0]).toBe(`http://gateway.test${path}`);
    expect(sentHeaders()).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json', 'X-Forwarded-For': '2001:db8::7' });
  });

  it('forwards IP for both catalog list and detail without changing Accept', async () => {
    process.env.CLIENT_IP_SOURCE_HEADER = 'X-Real-IP';
    incoming.set('X-Real-IP', '198.51.100.11');
    await getCatalog({});
    expect(fetchMock.mock.lastCall?.[0]).toContain('/api/v1/catalog/classes?');
    expect(sentHeaders()).toEqual({ Accept: 'application/json', 'X-Forwarded-For': '198.51.100.11' });
    await getCatalogClass(id);
    expect(fetchMock.mock.lastCall?.[0]).toContain(`/api/v1/catalog/classes/${id}`);
    expect(sentHeaders()).toEqual({ Accept: 'application/json', 'X-Forwarded-For': '198.51.100.11' });
  });

  it('forwards IP on checkout without losing authorization, content type or idempotency key', async () => {
    process.env.CLIENT_IP_SOURCE_HEADER = 'X-Real-IP';
    incoming.set('X-Real-IP', '198.51.100.12');
    await enrollInClass(id, { success: false, message: '' }, form({ student_id: id, billing_cycle: 'monthly', schedule_id: '', idempotency_key: id }));
    expect(fetchMock.mock.lastCall?.[0]).toBe(`http://gateway.test/api/v1/catalog/classes/${id}/enrollments`);
    expect(sentHeaders()).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': id, 'X-Forwarded-For': '198.51.100.12' });
  });
});
