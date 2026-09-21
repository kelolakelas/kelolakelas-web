import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the tenant member invitation Server Action (KEL-36).
 *
 * The acceptance criteria require the members screen to reflect the real
 * delivery outcome instead of always claiming success, so what is asserted is
 * the observable action contract for both outcomes of the email attempt:
 *
 * - a stored invitation with `email_sent: true` keeps the backend message and
 *   carries `emailSent: true`,
 * - a stored invitation with `email_sent: false` keeps `success: true` (the
 *   invitation row exists) but reports the failed delivery, and
 * - a backend error still surfaces its own message as a failure.
 *
 * `next/headers`, `next/cache`, and `@/lib/gateway` are mocked through
 * `vi.mock` rather than by stubbing globals because the action imports them by
 * module path; `fetch` is stubbed per test.
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

const { inviteTenantMember } = await import('./actions');

const GATEWAY_URL = 'http://gateway.test';
const INVITATIONS_PATH = `${GATEWAY_URL}/api/v1/invitations`;

function success(data: unknown = {}, message = '') {
  return new Response(JSON.stringify({ status: 'success', message, data }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

function failure(status: number, message = 'refused') {
  return new Response(JSON.stringify({ status: 'error', message, data: null }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

function formDataOf(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

const VALID_FORM = { email: 'staff@example.com', roleId: 'role-1' };
const EMPTY_STATE = { success: false, message: '' };

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

describe('inviteTenantMember', () => {
  it('reports a delivered invitation using the backend message', async () => {
    installFetch(
      success(
        {
          email: 'staff@example.com',
          email_sent: true,
        },
        'Invitation created and email sent successfully'
      )
    );

    const state = await inviteTenantMember(EMPTY_STATE, formDataOf(VALID_FORM));

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(INVITATIONS_PATH);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect(state.success).toBe(true);
    expect(state.emailSent).toBe(true);
    expect(state.message).toBe('Invitation created and email sent successfully');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/members');
  });

  it('stays a success when the email failed but states the delivery outcome', async () => {
    installFetch(
      success(
        {
          email: 'staff@example.com',
          email_sent: false,
        },
        'Invitation created but the email could not be sent. Please ask the member to contact support or resend the invitation later.'
      )
    );

    const state = await inviteTenantMember(EMPTY_STATE, formDataOf(VALID_FORM));

    expect(state.success).toBe(true);
    expect(state.emailSent).toBe(false);
    expect(state.message).toBe('Invitation created but the email could not be sent. Please ask the member to contact support or resend the invitation later.');
    expect(state.message).not.toContain('sent successfully');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/members');
  });

  it('falls back to its own message when the backend omits email_sent', async () => {
    installFetch(success({ email: 'staff@example.com' }));

    const state = await inviteTenantMember(EMPTY_STATE, formDataOf(VALID_FORM));

    expect(state.success).toBe(true);
    expect(state.emailSent).toBe(false);
    expect(state.message).toContain('could not be sent');
    expect(state.message).toContain('staff@example.com');
  });

  it('surfaces a backend rejection as a failure without delivery state', async () => {
    installFetch(failure(403, 'Permission denied'));

    const state = await inviteTenantMember(EMPTY_STATE, formDataOf(VALID_FORM));

    expect(state.success).toBe(false);
    expect(state.emailSent).toBeUndefined();
    expect(state.message).toBe('Permission denied');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('never reaches the network when validation fails', async () => {
    installFetch(success({}));

    const state = await inviteTenantMember(
      EMPTY_STATE,
      formDataOf({ email: 'not-an-email', roleId: 'role-1' })
    );

    expect(state.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
