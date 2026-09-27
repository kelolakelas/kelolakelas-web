import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration tests for the member-removal Server Action (KEL-81):
 * `DELETE /api/v1/members/:id` with the session token, then revalidation.
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

const { removeTenantMember } = await import('./actions');

const GATEWAY_URL = 'http://gateway.test';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const EMPTY_STATE = { success: false, message: '' };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
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

function removeForm(memberId = MEMBER_ID, memberName = 'Rina Tutor'): FormData {
  const formData = new FormData();
  formData.set('memberId', memberId);
  formData.set('memberName', memberName);
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

describe('removeTenantMember', () => {
  it('deletes the member with the session token and revalidates the member list and overview', async () => {
    installFetch(json(200, { status: 'success', message: 'Member removed successfully', data: null }));

    const result = await removeTenantMember(EMPTY_STATE, removeForm());

    expect(result).toEqual({ success: true, message: 'Rina Tutor was removed from the organization.' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GATEWAY_URL}/api/v1/members/${MEMBER_ID}`);
    expect(init.method).toBe('DELETE');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/members');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant');
  });

  it('falls back to a generic success message without a member name', async () => {
    installFetch(json(200, { status: 'success', message: 'Member removed successfully', data: null }));

    const result = await removeTenantMember(EMPTY_STATE, removeForm(MEMBER_ID, ''));

    expect(result).toEqual({ success: true, message: 'The member was removed from the organization.' });
  });

  it.each([
    [403, 'Permission denied', 'Access denied. You do not have permission to remove members.'],
    [
      404,
      'Member not found',
      'This member is no longer in the organization. They may have been removed in another session. Refresh the page to see the current members.',
    ],
    [409, 'You cannot remove your own membership', 'You cannot remove your own membership.'],
    [401, 'Unauthorized', 'Your session has expired. Sign in again to remove members.'],
  ])('maps %i to a readable refusal and changes nothing on screen', async (status, backendMessage, expected) => {
    installFetch(json(status, { status: 'error', message: backendMessage, data: null }));

    const result = await removeTenantMember(EMPTY_STATE, removeForm());

    expect(result).toEqual({ success: false, message: expected });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([500, 502, 503])('maps %i to a generic failure without technical detail', async (status) => {
    installFetch(json(status, { status: 'error', message: 'pq: connection reset by peer', data: null }));

    const result = await removeTenantMember(EMPTY_STATE, removeForm());

    expect(result).toEqual({
      success: false,
      message: 'The member could not be removed right now. Please try again later.',
    });
    expect(result.message).not.toContain('pq:');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('handles a 5xx proxy page that is not JSON', async () => {
    installFetch(new Response('<html>Bad Gateway</html>', { status: 502 }));

    const result = await removeTenantMember(EMPTY_STATE, removeForm());

    expect(result.success).toBe(false);
    expect(result.message).toBe('The member could not be removed right now. Please try again later.');
  });

  it('reports a network failure without leaking the error', async () => {
    fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed: ECONNREFUSED 10.0.0.5:8080');
    });
    vi.stubGlobal('fetch', fetchMock);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await removeTenantMember(EMPTY_STATE, removeForm());

    expect(result).toEqual({
      success: false,
      message: 'The member could not be removed right now. Please try again later.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it.each(['', 'not-a-uuid', '../roles/1', `${MEMBER_ID}/role`])(
    'rejects member id %j before sending any request',
    async (memberId) => {
      fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const result = await removeTenantMember(EMPTY_STATE, removeForm(memberId));

      expect(result.success).toBe(false);
      expect(result.message).toBe('This member could not be identified. Refresh the page and try again.');
      expect(result.errors?.memberId?.length).toBeGreaterThan(0);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  );
});
