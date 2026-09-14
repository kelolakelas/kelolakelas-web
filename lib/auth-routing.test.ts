import { describe, expect, it } from 'vitest';
import {
  getLoginDestination,
  hasTenantContext,
  isSafeRedirectPath,
  PARENT_DESTINATION,
  TENANT_DESTINATION,
  UNKNOWN_DESTINATION,
} from './auth-routing';

describe('auth routing', () => {
  it('uses the parent catalog as the parent login destination', () => {
    expect(getLoginDestination({ is_parent: true })).toBe(PARENT_DESTINATION);
  });

  it('uses the tenant dashboard when login returns tenant context', () => {
    expect(getLoginDestination({ is_parent: false, tenant_id: 'tenant-123' })).toBe(TENANT_DESTINATION);
  });

  it('preserves only a role-compatible internal redirect', () => {
    expect(getLoginDestination({ is_parent: true }, '/kelas/abc')).toBe('/kelas/abc');
    expect(getLoginDestination({ is_parent: true }, '/dashboard/tenant')).toBe(PARENT_DESTINATION);
    expect(getLoginDestination({ is_parent: false, tenant_id: 'tenant-123' }, '/dashboard/tenant/classes')).toBe(
      '/dashboard/tenant/classes'
    );
  });

  it('rejects external and malformed redirect paths', () => {
    expect(isSafeRedirectPath('https://attacker.test')).toBe(false);
    expect(isSafeRedirectPath('//attacker.test')).toBe(false);
    expect(isSafeRedirectPath('/dashboard/tenant')).toBe(true);
    expect(getLoginDestination({ is_parent: false }, '/dashboard/tenant')).toBe(UNKNOWN_DESTINATION);
  });

  it('does not treat a nil UUID as tenant context', () => {
    expect(hasTenantContext('00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(hasTenantContext('tenant-123')).toBe(true);
  });
});
