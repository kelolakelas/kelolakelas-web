import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readTenantNav } from './membership';

/**
 * KEL-136 membership query.
 *
 * The layout reads the membership server-side and decides the navigation:
 * Creator data yields the full menu, Teacher data yields the filtered one,
 * and every failure mode (API error, forbidden, configuration, malformed
 * body, empty permissions) yields the minimum safe menu (Overview only) —
 * never the full admin menu.
 */

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.stubGlobal('fetch', mocks.fetch);

function cookieJar(token = 'token', tenant = 'tenant') {
  return {
    get: (name: string) => {
      if (name === 'auth_token') return { value: token };
      if (name === 'tenant_id') return { value: tenant };
      return undefined;
    },
  };
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = 'https://gateway.example';
  mocks.cookies.mockResolvedValue(cookieJar());
});

describe('readTenantNav (KEL-136)', () => {
  it('returns the full menu and role name for Creator data', async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse(200, {
        status: 'success',
        data: {
          member_id: 'member',
          role_id: 'role',
          role_name: 'Creator',
          permissions: ['class:read', 'schedule:read', 'enrollment:read', 'chat:manage', 'member:read', 'role:read', 'tenant:read'],
        },
      })
    );

    const result = await readTenantNav();

    expect(result.state).toBe('ok');
    if (result.state !== 'ok') return;
    expect(result.roleName).toBe('Creator');
    expect(result.items.map((item) => item.label)).toEqual([
      'Overview',
      'Classes',
      'Sesi Saya',
      'Enrollments',
      'Schedule Requests',
      'Chat',
      'Members',
      'Roles & Permissions',
      'Settings',
    ]);
    expect(result.membership.role_name).toBe('Creator');
  });

  it('returns the filtered menu and Teacher role name for Teacher data', async () => {
    // KEL-137 offers the tutor session screen behind `schedule:read`, so a
    // Teacher sees it alongside Overview (see the nav filter test); the
    // footer still names the role.
    mocks.fetch.mockResolvedValue(
      jsonResponse(200, {
        status: 'success',
        data: {
          member_id: 'member',
          role_id: 'role',
          role_name: 'Teacher',
          permissions: ['schedule:read', 'attendance:read', 'student_note:read', 'report:read'],
        },
      })
    );

    const result = await readTenantNav();

    expect(result.state).toBe('ok');
    if (result.state !== 'ok') return;
    expect(result.roleName).toBe('Teacher');
    const visible = result.items.map((item) => item.label);
    expect(visible).toEqual(['Overview', 'Sesi Saya']);
    expect(visible).not.toContain('Members');
    expect(visible).not.toContain('Roles & Permissions');
    expect(visible).not.toContain('Settings');
  });

  it('falls back to the minimum safe menu on an API error', async () => {
    mocks.fetch.mockResolvedValue(jsonResponse(500, { status: 'error', data: null }));

    const result = await readTenantNav();

    expect(result.state).toBe('api');
    expect(result.roleName).toBeNull();
    expect(result.membership).toBeNull();
    expect(result.items.map((item) => item.label)).toEqual(['Overview']);
  });

  it('falls back to the minimum safe menu when the membership is inactive (403)', async () => {
    mocks.fetch.mockResolvedValue(jsonResponse(403, { status: 'error', message: 'Active membership is required' }));

    const result = await readTenantNav();

    expect(result.state).toBe('forbidden');
    expect(result.items.map((item) => item.label)).toEqual(['Overview']);
  });

  it('falls back to the minimum safe menu on a gateway failure', async () => {
    mocks.fetch.mockRejectedValue(new Error('fetch failed'));

    const result = await readTenantNav();

    expect(result.state).toBe('api');
    expect(result.items.map((item) => item.label)).toEqual(['Overview']);
  });

  it('falls back to the minimum safe menu when the gateway is misconfigured', async () => {
    delete process.env.GATEWAY_API_URL;

    const result = await readTenantNav();

    expect(result.state).toBe('configuration');
    expect(result.items.map((item) => item.label)).toEqual(['Overview']);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('falls back to the minimum safe menu on a malformed envelope', async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse(200, { status: 'success', data: { role_name: 'Creator' } })
    );

    const result = await readTenantNav();

    expect(result.state).toBe('api');
    expect(result.items.map((item) => item.label)).toEqual(['Overview']);
  });

  it('returns only Overview for a custom role with no permissions', async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse(200, {
        status: 'success',
        data: { member_id: 'member', role_id: 'role', role_name: 'Staff', permissions: [] },
      })
    );

    const result = await readTenantNav();

    expect(result.state).toBe('ok');
    if (result.state !== 'ok') return;
    expect(result.roleName).toBe('Staff');
    expect(result.items.map((item) => item.label)).toEqual(['Overview']);
  });
});
