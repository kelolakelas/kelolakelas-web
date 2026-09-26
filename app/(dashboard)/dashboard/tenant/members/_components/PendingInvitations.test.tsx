import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { formatInvitationExpiry } from '@/lib/invitation';
import type { InvitationListItem, Role } from '../_schemas/schema';

/**
 * Render tests for the pending invitation list (KEL-84). Server Actions are
 * mocked because this covers markup only; the action contract lives in
 * `invitationActions.test.ts`.
 */

vi.mock('../_actions/actions', () => ({
  revokeTenantInvitation: vi.fn(),
  resendTenantInvitation: vi.fn(),
}));

const { PendingInvitations, PendingInvitationsSkeleton } = await import('./PendingInvitations');

const ROLES: Role[] = [{ id: 'role-1', name: 'Tutor' }];

const ACTIVE: InvitationListItem = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'pending@example.com',
  role_id: 'role-1',
  expires_at: '2026-09-28T10:00:00Z',
  status: 'active',
  email_sent: true,
};

const EXPIRED: InvitationListItem = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'late@example.com',
  role_id: 'role-unknown',
  expires_at: '2026-09-20T10:00:00Z',
  status: 'expired',
  email_sent: false,
};

describe('PendingInvitations', () => {
  it('lists email, role name and expiry with resend and revoke actions', () => {
    const html = renderToStaticMarkup(
      <PendingInvitations read={{ state: 'ok', invitations: [ACTIVE] }} roles={ROLES} />
    );

    expect(html).toContain('pending@example.com');
    expect(html).toContain('Role: Tutor');
    expect(html).toContain(`Expires ${formatInvitationExpiry(ACTIVE.expires_at)}`);
    expect(html).toContain('17:00 WIB');
    expect(html).toContain('>Pending<');
    expect(html).toContain('>Resend<');
    expect(html).toContain('>Revoke<');
    expect(html).toContain(`name="invitationId" value="${ACTIVE.id}"`);
    expect(html).toContain('name="roleId" value="role-1"');
    expect(html).toContain('aria-labelledby="revoke-invitation-title-11111111-1111-4111-8111-111111111111"');
    expect(html).toContain('Revoke Invitation');
    expect(html).toContain('1 pending, 0 expired');
  });

  it('shows an expired invitation as expired and does not count it as pending', () => {
    const html = renderToStaticMarkup(
      <PendingInvitations read={{ state: 'ok', invitations: [ACTIVE, EXPIRED] }} roles={ROLES} />
    );

    const expiredRow = html.split('<li').find((row) => row.includes('late@example.com')) ?? '';
    expect(expiredRow).toContain('>Expired<');
    expect(expiredRow).not.toContain('>Pending<');
    // Unknown role ids fall back to the id instead of hiding the row.
    expect(expiredRow).toContain('Role: role-unknown');
    expect(html).toContain('1 pending, 1 expired');
  });

  it('keys rows by normalised email so a resend (new invitation id) keeps the row mounted', () => {
    const rowKeys = (invitations: InvitationListItem[]) => {
      const section = PendingInvitations({ read: { state: 'ok', invitations }, roles: ROLES }) as ReactElement<{
        children: ReactElement<{ children: ReactElement[] }>;
      }>;
      return section.props.children.props.children.map((row) => row.key);
    };

    const mixedCase = { ...ACTIVE, email: 'Pending@Example.com' };
    // Identity's resend replaces the invitation with a new row and a new id.
    const resent = { ...mixedCase, id: '33333333-3333-4333-8333-333333333333' };

    expect(rowKeys([mixedCase, EXPIRED])).toEqual(['pending@example.com', 'late@example.com']);
    expect(rowKeys([resent])).toEqual(rowKeys([mixedCase]));
  });

  it('uses the current invitation id in the revoke form after a resend', () => {
    const resent = { ...ACTIVE, id: '33333333-3333-4333-8333-333333333333' };
    const html = renderToStaticMarkup(
      <PendingInvitations read={{ state: 'ok', invitations: [resent] }} roles={ROLES} />
    );

    expect(html).toContain(`name="invitationId" value="${resent.id}"`);
    expect(html).not.toContain(`value="${ACTIVE.id}"`);
  });

  it('renders the empty state', () => {
    const html = renderToStaticMarkup(
      <PendingInvitations read={{ state: 'ok', invitations: [] }} roles={ROLES} />
    );

    expect(html).toContain('No pending invitations');
    expect(html).not.toContain('<li');
  });

  it('renders the forbidden state without actions', () => {
    const html = renderToStaticMarkup(
      <PendingInvitations read={{ state: 'forbidden' }} roles={ROLES} />
    );

    expect(html).toContain('You cannot view invitations');
    expect(html).toContain('member:invite');
    expect(html).not.toContain('Revoke');
  });

  it('renders the error state as an alert', () => {
    const html = renderToStaticMarkup(<PendingInvitations read={{ state: 'error' }} roles={ROLES} />);

    expect(html).toContain('role="alert"');
    expect(html).toContain('Invitations could not be loaded');
  });

  it('renders a loading skeleton', () => {
    const html = renderToStaticMarkup(<PendingInvitationsSkeleton />);

    expect(html).toContain('aria-label="Loading invitations"');
  });
});
