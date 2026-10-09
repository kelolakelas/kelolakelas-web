// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const actionState = vi.hoisted(() => ({
  current: { success: false, message: '' } as Record<string, unknown>,
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: () => [actionState.current, vi.fn()],
}));

vi.mock('../_actions/actions', () => ({ inviteTenantMember: vi.fn() }));

import { InviteMemberForm } from './InviteMemberForm';
import type { Role } from '../_schemas/schema';

/**
 * Render tests for the honest read-only role permission display (KEL-173).
 *
 * The old form rendered every tenant permission as a pre-checked checkbox
 * while the invitation payload ignored them entirely. The permission list is
 * now informational only: nothing renders before a role is chosen, the chosen
 * role's permissions render as plain text (zero checkbox/input elements), and
 * a role without permissions renders no fallback list.
 */

const TEACHER: Role = {
  id: 'role-teacher',
  name: 'Teacher',
  permissions: [
    { id: 'perm-1', name: 'classes.read' },
    { id: 'perm-2', name: 'sessions.write' },
  ],
};

const EMPTY_ROLE: Role = {
  id: 'role-empty',
  name: 'Observer',
  permissions: [],
};

const ROLES: Role[] = [TEACHER, EMPTY_ROLE];

function renderForm() {
  return render(<InviteMemberForm roles={ROLES} />);
}

function selectRole(value: string) {
  fireEvent.change(screen.getByLabelText(/Assign Role/), {
    target: { value },
  });
}

beforeEach(() => {
  actionState.current = { success: false, message: '' };
});

afterEach(() => {
  cleanup();
});

describe('InviteMemberForm role permissions (KEL-173)', () => {
  it('renders no permission checkbox before a role is selected', () => {
    const { container } = renderForm();

    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(
      container.querySelector('input[name="permissionIds"]')
    ).toBeNull();
    expect(
      screen.queryByText('Permissions included in this role')
    ).toBeNull();
  });

  it('renders the selected role permissions as a read-only list', () => {
    const { container } = renderForm();

    selectRole(TEACHER.id);

    expect(screen.getByText('Permissions included in this role')).toBeTruthy();
    expect(screen.getByText('classes.read')).toBeTruthy();
    expect(screen.getByText('sessions.write')).toBeTruthy();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(
      container.querySelector('input[name="permissionIds"]')
    ).toBeNull();
  });

  it('renders no fallback list for a role without permissions', () => {
    const { container } = renderForm();

    selectRole(EMPTY_ROLE.id);

    expect(
      screen.queryByText('Permissions included in this role')
    ).toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('refreshes the list when the role changes and hides it when cleared', () => {
    const { container } = renderForm();

    selectRole(TEACHER.id);
    expect(screen.getByText('classes.read')).toBeTruthy();

    selectRole(EMPTY_ROLE.id);
    expect(screen.queryByText('classes.read')).toBeNull();
    expect(
      screen.queryByText('Permissions included in this role')
    ).toBeNull();

    selectRole(TEACHER.id);
    expect(screen.getByText('sessions.write')).toBeTruthy();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('shows the action validation message without any permission input', () => {
    actionState.current = {
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors: { email: ['Please enter a valid email address.'] },
    };
    const { container } = renderForm();

    expect(
      screen.getByText('Validation failed. Please correct the highlighted errors.')
    ).toBeTruthy();
    expect(
      screen.getByText('Please enter a valid email address.')
    ).toBeTruthy();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(
      container.querySelector('input[name="permissionIds"]')
    ).toBeNull();
  });
});
