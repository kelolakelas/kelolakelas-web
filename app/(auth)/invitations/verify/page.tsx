import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getSessionIdentityFromToken } from '@/lib/auth-session';
import {
  formatInvitationExpiry,
  invitationStatusMessage,
  invitationStatusTitle,
  lookupInvitationTenantName,
  verifyInvitation,
} from '@/lib/invitation';
import { InvitationRegisterForm } from './_components/InvitationRegisterForm';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';

export const metadata: Metadata = {
  title: 'Accept invitation - Tutorin',
  description: 'Accept a tenant invitation and create your member account on Tutorin.',
  alternates: {
    canonical: `${appUrl}/invitations/verify`,
  },
  openGraph: {
    title: 'Accept invitation - Tutorin',
    description: 'Accept a tenant invitation and create your member account on Tutorin.',
    url: `${appUrl}/invitations/verify`,
    siteName: 'Tutorin',
    type: 'website',
  },
  robots: {
    index: false,
    follow: false,
  },
};

type InvitationPageProps = {
  searchParams: Promise<{ token?: string }>;
};

/**
 * Failure state card: the link cannot be turned into a registration form, so
 * the page explains why and offers a way forward instead of an empty form.
 */
function InvitationNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="w-full max-w-xl rounded-2xl border border-gray-100 bg-white p-5 shadow-xl sm:p-8">
      <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
      <p className="mt-3 text-sm text-gray-600">{message}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="flex min-h-[44px] items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-xs transition-all duration-150 hover:bg-indigo-500"
        >
          Go to sign in
        </Link>
        <Link
          href="/"
          className="flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-all duration-150 hover:border-gray-400"
        >
          Back to Tutorin
        </Link>
      </div>
    </div>
  );
}

export default async function InvitationVerifyPage({ searchParams }: InvitationPageProps) {
  const params = await searchParams;
  const token = params.token?.trim() || '';

  // The invitation is verified before anything else renders: the page never
  // shows a registration form for a token the identity service has not
  // confirmed, so an expired or already-used link cannot be answered with a
  // form that is guaranteed to fail on submit.
  const verification = await verifyInvitation(token);

  if (verification.state !== 'valid') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <InvitationNotice
          title={invitationStatusTitle(verification.state)}
          message={invitationStatusMessage(verification.state)}
        />
      </main>
    );
  }

  const { invitation } = verification;
  // Best effort: the tenant name lives in the catalog projection, not in the
  // invitation contract, so a missing name degrades to the generic sentence.
  const tenantName = await lookupInvitationTenantName(invitation.tenantId);
  const expiresLabel = formatInvitationExpiry(invitation.expiresAt);

  const cookieStore = await cookies();
  const session = getSessionIdentityFromToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  const signedInNotice = session
    ? 'You are signed in with another account in this browser. Creating this account signs nobody out, but the invitation belongs to the address above, not to the signed-in account.'
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full max-w-xl space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xl sm:p-8">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
            {tenantName ? `You are invited to join ${tenantName}` : 'You are invited to join a tenant'}
          </h1>
          <p className="mt-2 text-xs text-gray-500 sm:text-sm">
            Verify the details below before creating your account.
          </p>
          <dl className="mt-4 space-y-2 text-xs sm:text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-gray-700">Tenant:</dt>
              <dd className="text-gray-600">
                {tenantName || 'The inviting tenant name is not published yet.'}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-gray-700">Invited address:</dt>
              <dd className="text-gray-600">{invitation.email}</dd>
            </div>
            {expiresLabel && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-gray-700">Valid until:</dt>
                <dd className="text-gray-600">{expiresLabel}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            The tenant and the member role of this account are fixed by the invitation, so the form
            below only asks for the name and password you want to use.
          </p>
        </div>

        {signedInNotice && (
          <div
            role="status"
            className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 sm:p-4 sm:text-sm"
          >
            <p className="font-medium">{signedInNotice}</p>
          </div>
        )}

        <InvitationRegisterForm token={token} email={invitation.email} expiresLabel={expiresLabel} />
      </div>
    </main>
  );
}
