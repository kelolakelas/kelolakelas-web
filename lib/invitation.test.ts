import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyInvitationFailure,
  formatInvitationExpiry,
  invitationRegisterErrorMessage,
  invitationStatusMessage,
  invitedUserRegistrationSchema,
  inviteDeliveryMessage,
  lookupInvitationTenantName,
  normalizeInvitationDetails,
  verifyInvitation,
} from './invitation';

const originalGatewayApiUrl = process.env.GATEWAY_API_URL;

function stubFetch(handler: () => Promise<Response> | Response) {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  process.env.GATEWAY_API_URL = 'http://gateway.test:8000';
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalGatewayApiUrl === undefined) {
    delete process.env.GATEWAY_API_URL;
  } else {
    process.env.GATEWAY_API_URL = originalGatewayApiUrl;
  }
});

describe('normalizeInvitationDetails', () => {
  it('keeps the displayable facts and drops the token', () => {
    const invitation = normalizeInvitationDetails({
      id: 'invitation-id',
      tenant_id: '123e4567-e89b-12d3-a456-426614174000',
      role_id: '123e4567-e89b-12d3-a456-426614174001',
      email: 'member@example.com',
      token: '11111111-2222-3333-4444-555555555555',
      is_used: false,
      expires_at: '2026-09-18T11:49:09.205Z',
    });

    expect(invitation).toEqual({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      roleId: '123e4567-e89b-12d3-a456-426614174001',
      email: 'member@example.com',
      expiresAt: '2026-09-18T11:49:09.205Z',
    });
    expect(JSON.stringify(invitation)).not.toContain('11111111-2222-3333-4444-555555555555');
  });

  it('rejects payloads without a tenant or an email', () => {
    expect(normalizeInvitationDetails({ tenant_id: 'tenant', email: '  ' })).toBeNull();
    expect(normalizeInvitationDetails({ email: 'member@example.com' })).toBeNull();
    expect(normalizeInvitationDetails(null)).toBeNull();
    expect(normalizeInvitationDetails('not-an-object')).toBeNull();
  });

  it('tolerates a missing expiry', () => {
    expect(
      normalizeInvitationDetails({ tenant_id: 'tenant', email: 'member@example.com' })
    ).toEqual({ tenantId: 'tenant', roleId: '', email: 'member@example.com', expiresAt: null });
  });
});

describe('classifyInvitationFailure', () => {
  it('distinguishes an expired token from a used one', () => {
    expect(classifyInvitationFailure(400, 'Invitation token has expired')).toBe('expired');
    expect(classifyInvitationFailure(400, 'Invitation token has already been used')).toBe('used');
    expect(classifyInvitationFailure(404, 'Invitation not found')).toBe('not_found');
  });

  it('treats a server failure as a retryable outage, not a broken link', () => {
    expect(classifyInvitationFailure(500, 'Failed to verify invitation')).toBe('unavailable');
    expect(classifyInvitationFailure(503, undefined)).toBe('unavailable');
  });

  it('falls back to an invalid-link state for unrecognized rejections', () => {
    expect(classifyInvitationFailure(400, 'Token parameter is required')).toBe('invalid');
    expect(classifyInvitationFailure(400, undefined)).toBe('invalid');
  });

  it('gives every state a distinct title and message', () => {
    const states = [
      'missing_token',
      'not_found',
      'expired',
      'used',
      'unavailable',
      'invalid',
    ] as const;

    const messages = states.map(invitationStatusMessage);

    expect(new Set(messages).size).toBe(states.length);
    for (const message of messages) expect(message.length).toBeGreaterThan(20);
  });
});

describe('verifyInvitation', () => {
  it('returns the invitation facts for a valid token', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(200, {
        status: 'success',
        message: 'Invitation is valid',
        data: {
          tenant_id: 'tenant-1',
          role_id: 'role-1',
          email: 'member@example.com',
          token: 'secret-token',
          expires_at: '2026-09-18T11:49:09.205Z',
        },
      })
    );

    const result = await verifyInvitation('token value');

    expect(result).toEqual({
      state: 'valid',
      invitation: {
        tenantId: 'tenant-1',
        roleId: 'role-1',
        email: 'member@example.com',
        expiresAt: '2026-09-18T11:49:09.205Z',
      },
    });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('http://gateway.test:8000/api/v1/invitations/verify?token=token%20value');
  });

  it('reports a missing token without calling the gateway', async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, { status: 'success' }));

    await expect(verifyInvitation('   ')).resolves.toEqual({ state: 'missing_token' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an expired token to the expired state', async () => {
    stubFetch(() =>
      jsonResponse(400, { status: 'error', message: 'Invitation token has expired' })
    );

    await expect(verifyInvitation('token')).resolves.toEqual({ state: 'expired' });
  });

  it('survives a non-JSON error body', async () => {
    stubFetch(() => new Response('<html>502</html>', { status: 502 }));

    await expect(verifyInvitation('token')).resolves.toEqual({ state: 'unavailable' });
  });

  it('survives a network failure', async () => {
    stubFetch(() => {
      throw new Error('connect ECONNREFUSED');
    });

    await expect(verifyInvitation('token')).resolves.toEqual({ state: 'unavailable' });
  });

  it('reports a misconfigured gateway as an outage instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;

    await expect(verifyInvitation('token')).resolves.toEqual({ state: 'unavailable' });
  });
});

describe('invitedUserRegistrationSchema', () => {
  const valid = {
    token: 'token',
    first_name: 'Rani',
    last_name: 'Pratama',
    password: 'secret123',
  };

  it('accepts a complete payload and trims names', () => {
    const parsed = invitedUserRegistrationSchema.parse({ ...valid, first_name: '  Rani  ' });

    expect(parsed.first_name).toBe('Rani');
  });

  it('requires both names and a password of at least six characters', () => {
    const result = invitedUserRegistrationSchema.safeParse({
      token: 'token',
      first_name: '',
      last_name: '   ',
      password: 'short',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.first_name).toBeDefined();
      expect(errors.last_name).toBeDefined();
      expect(errors.password).toEqual(['Password must be at least 6 characters long.']);
    }
  });

  it('rejects a missing token so a stripped query parameter cannot submit', () => {
    const result = invitedUserRegistrationSchema.safeParse({ ...valid, token: '  ' });

    expect(result.success).toBe(false);
  });
});

describe('invitationRegisterErrorMessage', () => {
  it('explains a consumed token and a taken email instead of echoing the backend', () => {
    expect(
      invitationRegisterErrorMessage(400, 'Invitation token has already been used')
    ).toContain('already used');
    expect(invitationRegisterErrorMessage(409, 'User with this email already exists')).toContain(
      'account already exists'
    );
  });

  it('replaces unreadable binding errors with an actionable message', () => {
    const message = invitationRegisterErrorMessage(
      400,
      "Key: 'RegisterInvitedUserPayload.Password' Error:Field validation for 'Password' failed on the 'min' tag"
    );

    expect(message).not.toContain('RegisterInvitedUserPayload');
    expect(message).toContain('identity service rejected');
  });

  it('reports an outage for 5xx answers', () => {
    expect(invitationRegisterErrorMessage(500, 'Failed to register user')).toContain(
      'could not be completed'
    );
  });
});

describe('formatInvitationExpiry', () => {
  it('renders the deadline in Jakarta time with an explicit zone label', () => {
    expect(formatInvitationExpiry('2026-09-18T11:49:09.205Z')).toBe('18 Sept 2026, 18:49 WIB');
  });

  it('returns nothing for missing or unparseable values', () => {
    expect(formatInvitationExpiry(null)).toBeNull();
    expect(formatInvitationExpiry('')).toBeNull();
    expect(formatInvitationExpiry('not-a-date')).toBeNull();
  });
});

describe('inviteDeliveryMessage', () => {
  it('keeps the familiar sent message for a delivered invitation', () => {
    expect(inviteDeliveryMessage(true, 'staff@example.com')).toBe(
      'Invitation successfully sent to staff@example.com.'
    );
  });

  it('states the failed delivery instead of claiming success', () => {
    const message = inviteDeliveryMessage(false, 'staff@example.com');
    expect(message).toContain('could not be sent');
    expect(message).toContain('staff@example.com');
    expect(message).not.toContain('successfully sent');
  });
});

describe('lookupInvitationTenantName', () => {
  it('reads the tenant name from the public catalog projection', async () => {
    stubFetch(() =>
      jsonResponse(200, {
        status: 'success',
        data: {
          items: [{ id: 'class-1', tenant_name: 'Bimbel Ceria' }],
          pagination: { page: 1, total_pages: 1, total_items: 1 },
        },
      })
    );

    await expect(lookupInvitationTenantName('tenant-1')).resolves.toBe('Bimbel Ceria');
  });

  it('stays silent when the tenant publishes no open class', async () => {
    stubFetch(() =>
      jsonResponse(200, {
        status: 'success',
        data: { items: [], pagination: { page: 1, total_pages: 0, total_items: 0 } },
      })
    );

    await expect(lookupInvitationTenantName('tenant-1')).resolves.toBeNull();
  });

  it('never lets an enrichment failure break the invitation page', async () => {
    stubFetch(() => {
      throw new Error('connect ECONNREFUSED');
    });

    await expect(lookupInvitationTenantName('tenant-1')).resolves.toBeNull();
    await expect(lookupInvitationTenantName('')).resolves.toBeNull();
  });
});
