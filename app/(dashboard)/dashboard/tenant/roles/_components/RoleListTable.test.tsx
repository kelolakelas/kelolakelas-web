import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { Permission, Role } from '../_lib/schema';

/**
 * Render tests for the role list actions (KEL-83).
 *
 * The acceptance criteria are about what a tenant sees: custom roles offer Edit
 * and Delete, system roles offer neither, and the delete confirmation is an
 * accessible dialog. The Server Actions are mocked because this test covers
 * markup only; the action contract lives in `roleActions.test.ts`.
 */

vi.mock('../_actions/roleActions', () => ({
  updateTenantRole: vi.fn(),
  deleteTenantRole: vi.fn(),
}));

const { RoleListTable } = await import('./RoleListTable');
const { RoleEditForm } = await import('./RoleEditForm');

const PERMISSIONS: Permission[] = [
  { id: 'perm-1', name: 'class:read' },
  { id: 'perm-2', name: 'member:read' },
];

const SYSTEM_ROLE: Role = {
  id: 'role-system',
  name: 'Owner',
  is_system_role: true,
  permissions: [PERMISSIONS[0]],
};

const CUSTOM_ROLE: Role = {
  id: 'role-custom',
  name: 'Senior Tutor',
  description: 'Leads tutors',
  is_system_role: false,
  permissions: [PERMISSIONS[1]],
};

describe('RoleListTable actions', () => {
  it('shows Edit and Delete for a custom role', () => {
    const html = renderToStaticMarkup(
      <RoleListTable roles={[CUSTOM_ROLE]} availablePermissions={PERMISSIONS} />
    );

    expect(html).toContain('>Edit<');
    expect(html).toContain('>Delete<');
    expect(html).toContain('role Senior Tutor');
  });

  it('shows no Edit or Delete action for a system role', () => {
    const html = renderToStaticMarkup(
      <RoleListTable roles={[SYSTEM_ROLE]} availablePermissions={PERMISSIONS} />
    );

    expect(html).toContain('Owner');
    expect(html).not.toContain('>Edit<');
    expect(html).not.toContain('>Delete<');
    expect(html).not.toContain('<dialog');
  });

  it('only attaches actions to the custom role when both kinds are listed', () => {
    const html = renderToStaticMarkup(
      <RoleListTable roles={[SYSTEM_ROLE, CUSTOM_ROLE]} availablePermissions={PERMISSIONS} />
    );

    expect(html).toContain('role Senior Tutor');
    expect(html).not.toContain('role Owner');
    expect(html.match(/<dialog/g)?.length).toBe(1);
  });

  it('renders an accessible delete confirmation dialog', () => {
    const html = renderToStaticMarkup(<RoleListTable roles={[CUSTOM_ROLE]} />);

    expect(html).toContain('aria-labelledby="delete-role-title-role-custom"');
    expect(html).toContain('aria-describedby="delete-role-description-role-custom"');
    expect(html).toContain('id="delete-role-title-role-custom"');
    expect(html).toContain('id="delete-role-description-role-custom"');
    expect(html).toContain('name="roleId" value="role-custom"');
    expect(html).toContain('Cancel');
    expect(html).toContain('Delete Role');
  });
});

describe('RoleEditForm', () => {
  it('is prefilled with the current name, description and permissions', () => {
    const html = renderToStaticMarkup(
      <RoleEditForm role={CUSTOM_ROLE} availablePermissions={PERMISSIONS} />
    );

    expect(html).toContain('name="roleId" value="role-custom"');
    expect(html).toContain('value="Senior Tutor"');
    expect(html).toContain('value="Leads tutors"');
    expect(html).toContain('name="permissionIds" value="perm-2"');
    expect(html).not.toContain('name="permissionIds" value="perm-1"');
    expect(html).toContain('maxLength="50"');
    expect(html).toContain('maxLength="200"');
  });
});
