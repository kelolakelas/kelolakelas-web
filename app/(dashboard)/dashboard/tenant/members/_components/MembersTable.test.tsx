import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Member, Role } from '../_schemas/schema';

/**
 * Render tests for the member table's remove control (KEL-81). The Server
 * Actions are mocked because this covers markup only; the action contract
 * lives in `removeMemberActions.test.ts`.
 */

const removeTenantMember = vi.fn();
vi.mock('../_actions/actions', () => ({
  updateMemberRole: vi.fn(),
  removeTenantMember: (...args: unknown[]) => removeTenantMember(...args),
}));

const { MembersTable } = await import('./MembersTable');

const ROLES: Role[] = [{ id: 'role-1', name: 'Tutor' }];
const SELF_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const SELF: Member = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: SELF_USER_ID,
  email: 'admin@example.com',
  first_name: 'Ayu',
  last_name: 'Admin',
  status: 'active',
};

const OTHER: Member = {
  id: '22222222-2222-4222-8222-222222222222',
  user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  email: 'tutor@example.com',
  first_name: 'Rina',
  last_name: 'Tutor',
  status: 'active',
};

function render(members: Member[], currentUserId: string | null) {
  return renderToStaticMarkup(
    <MembersTable members={members} roles={ROLES} currentUserId={currentUserId} />
  );
}

describe('MembersTable remove control', () => {
  it('offers removal for other members in both layouts but not on the signed-in user row', () => {
    const html = render([SELF, OTHER], SELF_USER_ID);

    expect(html.match(/<span class="sr-only"> Rina Tutor from the organization<\/span>/g)).toHaveLength(2);
    expect(html).not.toContain('Ayu Admin from the organization');
    expect(html).not.toContain(`remove-member-title-${SELF.id}`);
    // Role editing stays available on every row.
    expect(html.match(/Edit Role/g)).toHaveLength(4);
  });

  it('matches the signed-in user regardless of UUID letter case', () => {
    const html = render([SELF, OTHER], SELF_USER_ID.toUpperCase());

    expect(html).not.toContain('Ayu Admin from the organization');
    expect(html).toContain('Rina Tutor from the organization');
  });

  it('keeps the control on every row when the session has no usable user id', () => {
    const html = render([SELF, OTHER], null);

    expect(html).toContain('Ayu Admin from the organization');
    expect(html).toContain('Rina Tutor from the organization');
  });

  it('renders a labelled, described confirmation dialog that sends only on confirm', () => {
    const html = render([OTHER], SELF_USER_ID);

    for (const prefix of ['mobile', 'desktop']) {
      const titleId = `${prefix}-remove-member-title-${OTHER.id}`;
      const descriptionId = `${prefix}-remove-member-description-${OTHER.id}`;
      expect(html).toContain(`aria-labelledby="${titleId}"`);
      expect(html).toContain(`aria-describedby="${descriptionId}"`);
      expect(html).toContain(`id="${titleId}"`);
      expect(html).toContain(`id="${descriptionId}"`);
    }
    expect(html).toContain('Remove Rina Tutor from the organization?');
    // The dialog is closed until opened, and cancel is a plain button, not a submit.
    expect(html).not.toMatch(/<dialog[^>]*\sopen/);
    expect(html).toMatch(/<button type="button"[^>]*>Cancel<\/button>/);
    expect(html.match(/<button type="submit"[^>]*>Remove Member<\/button>/g)).toHaveLength(2);
    expect(html).toContain(`name="memberId" value="${OTHER.id}"`);
    // Rendering alone never calls the action.
    expect(removeTenantMember).not.toHaveBeenCalled();
  });

  it('keeps an empty status region mounted for the removal announcement', () => {
    expect(render([OTHER], SELF_USER_ID)).toContain('<p role="status" class="sr-only"></p>');
    expect(render([], SELF_USER_ID)).toContain('<p role="status" class="sr-only"></p>');
  });
});
