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

  it('returns a parent to the parent dashboard page that asked for login (KEL-44)', () => {
    const returnPath = '/dashboard/parent/enrollments/return?merchantOrderId=2d8f7a0c-7a0a-4aa8-8e54-000000000001&resultCode=00';
    expect(getLoginDestination({ is_parent: true }, returnPath)).toBe(returnPath);
    expect(getLoginDestination({ is_parent: true }, '/dashboard/parent/enrollments')).toBe('/dashboard/parent/enrollments');
    expect(getLoginDestination({ is_parent: true }, '/dashboard/parent')).toBe('/dashboard/parent');
  });

  it('never sends a non-parent to a parent dashboard page', () => {
    const returnPath = '/dashboard/parent/enrollments/return?merchantOrderId=abc';
    expect(getLoginDestination({ is_parent: false, tenant_id: 'tenant-123' }, returnPath)).toBe(TENANT_DESTINATION);
    expect(getLoginDestination({ is_parent: false }, returnPath)).toBe(UNKNOWN_DESTINATION);
  });

  it('does not treat a lookalike prefix as the parent dashboard', () => {
    expect(getLoginDestination({ is_parent: true }, '/dashboard/parentx')).toBe(PARENT_DESTINATION);
    expect(getLoginDestination({ is_parent: true }, '/dashboard/parent/../tenant')).toBe(PARENT_DESTINATION);
    expect(getLoginDestination({ is_parent: true }, '//attacker.test/dashboard/parent')).toBe(PARENT_DESTINATION);
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
