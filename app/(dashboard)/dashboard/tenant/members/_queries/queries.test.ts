import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTenantMembers } from './queries';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'auth_token') return { name, value: 'session-token' };
      if (name === 'tenant_id') return { name, value: 'tenant-1' };
      return undefined;
    },
  })),
}));

const GATEWAY_URL = 'http://gateway.test';
const firstMember = {
  id: 'member-1',
  email: 'first@example.com',
  first_name: 'First',
  last_name: 'Member',
};
const secondMember = {
  id: 'member-2',
  email: 'second@example.com',
  first_name: 'Second',
  last_name: 'Member',
};

function success(data: unknown) {
  return new Response(JSON.stringify({ status: 'success', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(response: Response | (() => Response)) {
  fetchMock = vi.fn(async () => (typeof response === 'function' ? response() : response));
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  savedGatewayUrl = process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = GATEWAY_URL;
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

describe('getTenantMembers', () => {
  it('reads the members and total from the paginated identity envelope', async () => {
    installFetch(
      success({
        items: [firstMember, secondMember],
        pagination: { page: 1, page_size: 20, total_items: 2, total_pages: 1 },
      })
    );

    const result = await getTenantMembers();

    expect(result.members.map((member) => member.id)).toEqual(['member-1', 'member-2']);
    expect(result.pagination).toEqual({
      page: 1,
      page_size: 20,
      total_items: 2,
      total_pages: 1,
    });
  });

  it('continues to read a legacy bare array without throwing', async () => {
    installFetch(success([firstMember, secondMember]));

    const result = await getTenantMembers();

    expect(result.members.map((member) => member.id)).toEqual(['member-1', 'member-2']);
    expect(result.pagination.total_items).toBe(2);
    expect(result.pagination.total_pages).toBe(1);
  });

  it('returns an empty result for a malformed successful payload', async () => {
    installFetch(success({ items: 'not-an-array', pagination: 'invalid' }));

    const result = await getTenantMembers(2);

    expect(result).toEqual({
      members: [],
      pagination: { page: 1, page_size: 0, total_items: 0, total_pages: 0 },
    });
  });

  it('returns an empty result for a non-OK response', async () => {
    installFetch(
      new Response(JSON.stringify({ status: 'error', data: null }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await getTenantMembers();

    expect(result.members).toEqual([]);
    expect(result.pagination.total_items).toBe(0);
  });

  it('requests the requested page with the fixed page size', async () => {
    installFetch(
      success({
        items: [firstMember],
        pagination: { page: 2, page_size: 20, total_items: 45, total_pages: 3 },
      })
    );

    const result = await getTenantMembers(2);
    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));

    expect(result.pagination.total_items).toBe(45);
    expect(requestedUrl.searchParams.get('page')).toBe('2');
    expect(requestedUrl.searchParams.get('page_size')).toBe('20');
  });
});
