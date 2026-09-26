import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration tests for the pending-invitation Server Actions (KEL-84):
 * revoke (`DELETE /api/v1/invitations/:id`, 204 without body) and resend
 * (`POST /api/v1/invitations` with the same email and role).
 *
 * `next/headers` and `next/cache` are mocked by module path; `fetch` is
 * stubbed per test.
 */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'auth_token') return { name, value: 'session-token' };
      if (name === 'tenant_id') return { name, value: 'tenant-1' };
      return undefined;
    },
  })),
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }));

const { revokeTenantInvitation, resendTenantInvitation } = await import('./actions');

const GATEWAY_URL = 'http://gateway.test';
const INVITATION_ID = '11111111-1111-4111-8111-111111111111';
const EMPTY_STATE = { success: false, message: '' };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorBody(status: number, message: string) {
  return json(status, { status: 'error', message, data: null });
}

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

function installFailingFetch() {
  fetchMock = vi.fn(async () => {
    throw new TypeError('fetch failed');
  });
  vi.stubGlobal('fetch', fetchMock);
}

function formDataOf(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  savedGatewayUrl = process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = GATEWAY_URL;
  revalidatePath.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();

  if (savedGatewayUrl === undefined) {
    delete process.env.GATEWAY_API_URL;
  } else {
    process.env.GATEWAY_API_URL = savedGatewayUrl;
  }
});

describe('revokeTenantInvitation', () => {
  const REVOKE_FORM = { invitationId: INVITATION_ID, email: 'pending@example.com' };

  it('treats 204 without a body as success and refreshes list and overview', async () => {
    installFetch(new Response(null, { status: 204 }));

    const state = await revokeTenantInvitation(EMPTY_STATE, formDataOf(REVOKE_FORM));

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `${GATEWAY_URL}/api/v1/invitations/${INVITATION_ID}`
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer session-token');
    expect(state.success).toBe(true);
    expect(state.message).toContain('pending@example.com');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/members');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant');
  });

  it('maps 403 to a permission message without revalidating', async () => {
    installFetch(errorBody(403, 'Permission denied'));

    const state = await revokeTenantInvitation(EMPTY_STATE, formDataOf(REVOKE_FORM));

    expect(state.success).toBe(false);
    expect(state.message).toBe('You do not have permission to revoke invitations.');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps 404 to an invitation-no-longer-pending message', async () => {
    installFetch(errorBody(404, 'Invitation not found'));

    const state = await revokeTenantInvitation(EMPTY_STATE, formDataOf(REVOKE_FORM));

    expect(state.success).toBe(false);
    expect(state.message).toContain('no longer pending');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('keeps the backend message for other failures, even with a non-JSON body', async () => {
    installFetch(errorBody(500, 'Failed to revoke invitation'));
    const withMessage = await revokeTenantInvitation(EMPTY_STATE, formDataOf(REVOKE_FORM));
    expect(withMessage).toEqual({ success: false, message: 'Failed to revoke invitation' });

    installFetch(new Response('<html>bad gateway</html>', { status: 502 }));
    const withoutJson = await revokeTenantInvitation(EMPTY_STATE, formDataOf(REVOKE_FORM));
    expect(withoutJson.success).toBe(false);
    expect(withoutJson.message).toBe('Failed to revoke invitation. Please try again.');
  });

  it('rejects an invalid invitation id before any request', async () => {
    installFetch(new Response(null, { status: 204 }));

    const state = await revokeTenantInvitation(
      EMPTY_STATE,
      formDataOf({ invitationId: '../members/1' })
    );

    expect(state.success).toBe(false);
    expect(state.errors?.invitationId).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a connection error when the network fails', async () => {
    installFailingFetch();

    const state = await revokeTenantInvitation(EMPTY_STATE, formDataOf(REVOKE_FORM));

    expect(state.success).toBe(false);
    expect(state.message).toContain('connection error');
  });
});

describe('resendTenantInvitation', () => {
  const RESEND_FORM = { email: 'pending@example.com', roleId: 'role-1' };

  it('re-posts email and role and reports a delivered email', async () => {
    installFetch(
      json(201, {
        status: 'success',
        message: 'Invitation created and email sent successfully',
        data: { id: INVITATION_ID, email: 'pending@example.com', email_sent: true },
      })
    );

    const state = await resendTenantInvitation(EMPTY_STATE, formDataOf(RESEND_FORM));

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`${GATEWAY_URL}/api/v1/invitations`);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      email: 'pending@example.com',
      role_id: 'role-1',
    });
    expect(state.success).toBe(true);
    expect(state.emailSent).toBe(true);
    expect(state.message).toBe('Invitation created and email sent successfully');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/members');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant');
  });

  it('stays a success but states a failed email delivery', async () => {
    installFetch(
      json(201, {
        status: 'success',
        message:
          'Invitation created but the email could not be sent. Please ask the member to contact support or resend the invitation later.',
        data: { email_sent: false },
      })
    );

    const state = await resendTenantInvitation(EMPTY_STATE, formDataOf(RESEND_FORM));

    expect(state.success).toBe(true);
    expect(state.emailSent).toBe(false);
    expect(state.message).toContain('could not be sent');
  });

  it('falls back to the local delivery message when the backend has none', async () => {
    installFetch(json(201, { status: 'success', data: { email_sent: true } }));

    const state = await resendTenantInvitation(EMPTY_STATE, formDataOf(RESEND_FORM));

    expect(state.message).toBe('Invitation successfully sent to pending@example.com.');
  });

  it('shows the 409 message when the email now has an account', async () => {
    installFetch(errorBody(409, 'User with this email already exists'));

    const state = await resendTenantInvitation(EMPTY_STATE, formDataOf(RESEND_FORM));

    expect(state.success).toBe(false);
    expect(state.emailSent).toBeUndefined();
    expect(state.message).toBe('User with this email already exists');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('uses a fallback 409 message when the body carries none', async () => {
    installFetch(new Response('', { status: 409 }));

    const state = await resendTenantInvitation(EMPTY_STATE, formDataOf(RESEND_FORM));

    expect(state.success).toBe(false);
    expect(state.message).toBe('An account already exists for this email address.');
  });

  it('maps 403 to a permission message', async () => {
    installFetch(errorBody(403, 'Permission denied'));

    const state = await resendTenantInvitation(EMPTY_STATE, formDataOf(RESEND_FORM));

    expect(state.message).toBe('You do not have permission to resend invitations.');
  });

  it('never reaches the network when email or role is missing', async () => {
    installFetch(json(201, { status: 'success', data: {} }));

    const state = await resendTenantInvitation(
      EMPTY_STATE,
      formDataOf({ email: 'not-an-email', roleId: '' })
    );

    expect(state.success).toBe(false);
    expect(state.errors?.email).toBeDefined();
    expect(state.errors?.roleId).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a connection error when the network fails', async () => {
    installFailingFetch();

    const state = await resendTenantInvitation(EMPTY_STATE, formDataOf(RESEND_FORM));

    expect(state.success).toBe(false);
    expect(state.message).toContain('connection error');
  });
});
