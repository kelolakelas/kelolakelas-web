import { formatInvitationExpiry } from '@/lib/invitation';
import { countActiveInvitations, type TenantInvitationsRead } from '../_queries/queries';
import type { Role } from '../_schemas/schema';
import { ResendInvitationButton } from './ResendInvitationButton';
import { RevokeInvitationButton } from './RevokeInvitationButton';

interface PendingInvitationsProps {
  read: TenantInvitationsRead;
  roles: Role[];
}

const HEADING_ID = 'pending-invitations-heading';

function Section({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <section aria-labelledby={HEADING_ID} className="space-y-3">
      <div>
        <h2 id={HEADING_ID} className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Pending Invitations
        </h2>
        {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Notice({ tone, title, children }: { tone: 'neutral' | 'warning' | 'error'; title: string; children: React.ReactNode }) {
  const styles = {
    neutral:
      'border-dashed border-gray-300 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400',
    warning:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    error:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
  }[tone];

  return (
    <div role={tone === 'error' ? 'alert' : undefined} className={`rounded-xl border p-5 text-sm ${styles}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs">{children}</p>
    </div>
  );
}

/**
 * Pending invitation list for the members page (KEL-84).
 *
 * Renders every state of the invitation read separately so that a forbidden
 * or failed read never hides the members table rendered next to it. Expired
 * invitations stay visible (so they can be resent or revoked) but carry an
 * Expired badge and are not counted as pending.
 */
export function PendingInvitations({ read, roles }: PendingInvitationsProps) {
  if (read.state === 'forbidden') {
    return (
      <Section>
        <Notice tone="warning" title="You cannot view invitations">
          Your role does not include the member:invite permission, so pending invitations are hidden.
          Ask a tenant administrator if you need access.
        </Notice>
      </Section>
    );
  }

  if (read.state === 'error') {
    return (
      <Section>
        <Notice tone="error" title="Invitations could not be loaded">
          The invitation list is unavailable right now. Refresh the page to try again.
        </Notice>
      </Section>
    );
  }

  const { invitations } = read;
  if (invitations.length === 0) {
    return (
      <Section>
        <Notice tone="neutral" title="No pending invitations">
          Invitations you send appear here until they are accepted, revoked or replaced.
        </Notice>
      </Section>
    );
  }

  const roleNames = new Map(roles.map((role) => [role.id, role.name]));
  const activeCount = countActiveInvitations(invitations);

  return (
    <Section subtitle={`${activeCount} pending, ${invitations.length - activeCount} expired`}>
      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-800">
        {invitations.map((invitation) => {
          const expired = invitation.status !== 'active';
          const expiry = formatInvitationExpiry(invitation.expires_at);
          const roleName = roleNames.get(invitation.role_id) || invitation.role_id || 'Unknown role';

          return (
            <li
              // Not invitation.id: resend replaces the row with a new id, and a new key would drop the resend status.
              key={invitation.email.toLowerCase()}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {invitation.email}
                  </span>
                  {expired ? (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                      Expired
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                      Pending
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Role: {roleName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {expiry ? `${expired ? 'Expired' : 'Expires'} ${expiry}` : 'Expiry unknown'}
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-2 sm:justify-end">
                <ResendInvitationButton invitation={invitation} />
                <RevokeInvitationButton invitation={invitation} />
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Loading state shown while the invitation list is read. */
export function PendingInvitationsSkeleton() {
  return (
    <Section>
      <div
        role="status"
        aria-label="Loading invitations"
        className="h-24 animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800/60"
      />
    </Section>
  );
}
