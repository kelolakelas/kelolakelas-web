import { z } from 'zod';
import { getCatalog, type CatalogList, type CatalogResult } from './catalog';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from './gateway';

/**
 * Client-safe helpers for the invitation acceptance flow (KEL-35).
 *
 * The invitation registration Server Action may only export async functions,
 * so the pure decision logic that turns a gateway response into a message or a
 * page state lives here where it can be unit tested.
 *
 * Two contracts back this module, both proxied by the API gateway:
 *
 * - `GET /api/v1/invitations/verify?token=...` answers `200` with the
 *   invitation row, `404` when the token is unknown and `400` with a message
 *   that distinguishes an expired token from an already-used one.
 * - `POST /api/v1/invitations/register` consumes
 *   `{ token, first_name, last_name, password }` and answers `201` on success,
 *   `400` for a rejected token or payload, `404` for an unknown token and `409`
 *   when the invited email already has an account. The role and tenant are
 *   always taken from the stored invitation, never from the browser.
 */

/** Invitation facts the acceptance page is allowed to display. */
export type InvitationDetails = {
  tenantId: string;
  roleId: string;
  email: string;
  expiresAt: string | null;
};

/**
 * Raw verify/register payloads also carry the invitation `token`. It is
 * deliberately dropped while normalizing so no code path downstream of this
 * module can render it into the page.
 */
export function normalizeInvitationDetails(raw: unknown): InvitationDetails | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const tenantId = typeof data.tenant_id === 'string' ? data.tenant_id.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim() : '';

  if (!tenantId || !email) return null;

  return {
    tenantId,
    roleId: typeof data.role_id === 'string' ? data.role_id.trim() : '',
    email,
    expiresAt: typeof data.expires_at === 'string' ? data.expires_at : null,
  };
}

/** Page states for a link that cannot be turned into a registration form. */
export type InvitationFailureState =
  | 'missing_token'
  | 'not_found'
  | 'expired'
  | 'used'
  | 'unavailable'
  | 'invalid';

export type InvitationVerification =
  | { state: 'valid'; invitation: InvitationDetails }
  | { state: InvitationFailureState };

/** The token is missing, so the link was copied incompletely. */
const MISSING_TOKEN_MESSAGE =
  'This link is incomplete. Open the invitation button in your invitation email again.';

/** The token does not belong to any stored invitation. */
const NOT_FOUND_MESSAGE =
  'This invitation could not be found. It may belong to an account that has been removed. Ask the tenant administrator to send a new invitation.';

/** The invitation exceeded its 48-hour lifetime. */
const EXPIRED_MESSAGE =
  'This invitation has expired. Ask the tenant administrator to send a new invitation.';

/** The invitation was already consumed by an earlier registration. */
const USED_MESSAGE =
  'This invitation has already been used. If you created the account, sign in instead. Otherwise ask the tenant administrator for a new invitation.';

/** The gateway or the identity service could not answer. */
const UNAVAILABLE_MESSAGE =
  'We could not check this invitation right now. Please try again in a moment.';

/** The token was rejected without a recognizable reason. */
const INVALID_MESSAGE =
  'This invitation link is not valid. Open the invitation button in your invitation email again.';

export function invitationStatusMessage(state: InvitationFailureState): string {
  switch (state) {
    case 'missing_token':
      return MISSING_TOKEN_MESSAGE;
    case 'not_found':
      return NOT_FOUND_MESSAGE;
    case 'expired':
      return EXPIRED_MESSAGE;
    case 'used':
      return USED_MESSAGE;
    case 'unavailable':
      return UNAVAILABLE_MESSAGE;
    default:
      return INVALID_MESSAGE;
  }
}

export function invitationStatusTitle(state: InvitationFailureState): string {
  switch (state) {
    case 'missing_token':
      return 'Invitation link incomplete';
    case 'not_found':
      return 'Invitation not found';
    case 'expired':
      return 'Invitation expired';
    case 'used':
      return 'Invitation already used';
    case 'unavailable':
      return 'Invitation check unavailable';
    default:
      return 'Invitation not valid';
  }
}

/**
 * Maps a failed verify answer onto a page state.
 *
 * The identity service reports an expired or used token as `400` and is the
 * only authority on which of the two fired, so the message decides. Anything
 * else that is not a `4xx` is treated as a temporary outage: the invitation may
 * still be perfectly valid, so the page asks the visitor to retry instead of
 * declaring the link broken.
 */
export function classifyInvitationFailure(
  status: number,
  backendMessage?: string | null
): InvitationFailureState {
  const message = (backendMessage || '').toLowerCase();

  if (message.includes('expired')) return 'expired';
  if (message.includes('already been used') || message.includes('already used')) return 'used';
  if (message.includes('not found')) return 'not_found';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'unavailable';
  return 'invalid';
}

/**
 * Verifies an invitation token through the public gateway route.
 *
 * The request is never cached, so a token that was consumed in another tab is
 * reported as used on the next page load instead of being served from cache.
 */
export async function verifyInvitation(token: string): Promise<InvitationVerification> {
  const trimmed = token.trim();
  if (!trimmed) return { state: 'missing_token' };

  let url: string;
  try {
    url = `${getGatewayBaseUrl()}/api/v1/invitations/verify?token=${encodeURIComponent(trimmed)}`;
  } catch (error) {
    const configMessage = getGatewayConfigurationErrorMessage(error);
    if (configMessage) console.error('[verifyInvitation Error]:', configMessage);
    return { state: 'unavailable' };
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const body = (await response.json().catch(() => null)) as
      | { status?: string; message?: string; data?: unknown }
      | null;

    if (response.ok && body?.status === 'success') {
      const invitation = normalizeInvitationDetails(body.data);
      return invitation ? { state: 'valid', invitation } : { state: 'invalid' };
    }

    return { state: classifyInvitationFailure(response.status, body?.message) };
  } catch (error) {
    console.error('[verifyInvitation Error]:', error);
    return { state: 'unavailable' };
  }
}

/**
 * Server-side schema for the invited-user registration payload.
 *
 * `email` is absent on purpose: the invitation row owns the address and the
 * identity service ignores a browser-supplied one, so offering the field would
 * only invite a mismatch between what the form promises and what is stored.
 */
export const invitedUserRegistrationSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, { message: 'The invitation link is incomplete. Open it again from your email.' }),
  first_name: z.string().trim().min(1, { message: 'First name is required.' }),
  last_name: z.string().trim().min(1, { message: 'Last name is required.' }),
  password: z
    .string()
    .min(1, { message: 'Password is required.' })
    .min(6, { message: 'Password must be at least 6 characters long.' }),
});

export type InvitedUserRegistrationValues = z.infer<typeof invitedUserRegistrationSchema>;

/** The token was consumed between opening the page and submitting the form. */
const SUBMIT_USED_MESSAGE =
  'This invitation was already used before this form was submitted. If you created the account, sign in instead.';

/** The token expired while the form was open. */
const SUBMIT_EXPIRED_MESSAGE =
  'This invitation expired before this form was submitted. Ask the tenant administrator for a new invitation.';

/** The invited email already has an account, so no second one can be created. */
const EMAIL_TAKEN_MESSAGE =
  'An account already exists for this email address. Sign in with your existing password instead, or ask the tenant administrator to invite a different address.';

/** A payload rule rejected the submission after server-side validation passed. */
const SUBMIT_REJECTED_MESSAGE =
  'The identity service rejected these details. Please check the form and try again.';

/** The gateway could not reach the identity service. */
const SUBMIT_UNAVAILABLE_MESSAGE =
  'The registration could not be completed right now. Please try again in a moment.';

/** Fallback when the backend answered without a usable message. */
const SUBMIT_GENERIC_MESSAGE =
  'Registration failed. Please try again.';

/**
 * Maps a failed invited-user registration onto a message the visitor can act on.
 *
 * `400` carries three different situations: an expired token, a used token or a
 * payload rule. The message decides which one, and anything unrecognized is
 * reported as a rejected payload rather than passed through, because the
 * binding errors the identity service emits (`Key: 'RegisterInvitedUserPayload
 * .FirstName' Error:Field validation ...`) are not readable by a visitor.
 */
export function invitationRegisterErrorMessage(
  status: number,
  backendMessage?: string | null
): string {
  const message = (backendMessage || '').toLowerCase();

  if (message.includes('expired')) return SUBMIT_EXPIRED_MESSAGE;
  if (message.includes('already been used') || message.includes('already used')) {
    return SUBMIT_USED_MESSAGE;
  }
  if (status === 404) return NOT_FOUND_MESSAGE;
  if (status === 409) return EMAIL_TAKEN_MESSAGE;
  if (status === 400) return SUBMIT_REJECTED_MESSAGE;
  if (status >= 500) return SUBMIT_UNAVAILABLE_MESSAGE;

  return backendMessage?.trim() || SUBMIT_GENERIC_MESSAGE;
}

/**
 * Looks up the tenant display name for an invitation, best effort only.
 *
 * The identity service verify response carries `tenant_id` but no tenant name,
 * and no public tenant-detail route exists (the tenant settings route requires
 * a session, which an invited person does not have yet). The public catalog is
 * the only place a tenant name is readable without authentication, so it is
 * used to enrich the page. It is a weaker source than the invitation itself:
 * it only answers when that tenant has a published, open class with an active
 * location snapshot, so a `null` result is expected and never an error. The
 * page still shows every fact the invitation owns.
 */
export async function lookupInvitationTenantName(tenantId: string): Promise<string | null> {
  const trimmed = tenantId.trim();
  if (!trimmed) return null;

  try {
    const result: CatalogResult<CatalogList> = await getCatalog({ tenant_id: trimmed });
    if (result.error) return null;

    const name = result.data.items[0]?.tenant_name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch (error) {
    console.error('[lookupInvitationTenantName Error]:', error);
    return null;
  }
}

/** Where a successful registration continues: the existing login success flow. */
export const INVITATION_SUCCESS_REDIRECT = '/login?registered=1';

/**
 * Formats the invitation expiry for display in Jakarta time.
 *
 * Invitations are valid for 48 hours from creation and the service compares
 * them against its own clock, so the page states the deadline explicitly, in
 * the timezone the recipients of the email are in, with a `WIB` suffix so the
 * value is never read as local time by mistake. Unparseable values produce no
 * line rather than an invalid date.
 */
export function formatInvitationExpiry(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const formatted = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date);

  return `${formatted} WIB`;
}
