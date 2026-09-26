import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the custom role edit and delete Server Actions (KEL-83).
 *
 * Asserted is the observable action contract: the request sent to the gateway,
 * revalidation of the roles list on success only, validation with the same rules
 * as role creation, and a specific, understandable message for the 403, 404 and
 * 409 refusals instead of a generic error.
 *
 * `next/headers` and `next/cache` are mocked by module path (as in
 * `members/_actions/inviteActions.test.ts`); `fetch` is stubbed per test.
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

const { updateTenantRole, deleteTenantRole } = await import('./roleActions');

const GATEWAY_URL = 'http://gateway.test';
const ROLE_PATH = `${GATEWAY_URL}/api/v1/roles/role-1`;
const EMPTY_STATE = { success: false, message: '' };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function success(data: unknown = null) {
  return jsonResponse(200, { status: 'success', message: 'ok', data });
}

function failure(status: number, message: string) {
  return jsonResponse(status, { status: 'error', message });
}

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

function updateForm(overrides: Partial<Record<'roleId' | 'name' | 'description', string>> = {}, permissionIds = ['perm-1', 'perm-2']) {
  const formData = new FormData();
  const fields = { roleId: 'role-1', name: 'Senior Tutor', description: 'Leads tutors', ...overrides };
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  for (const id of permissionIds) {
    formData.append('permissionIds', id);
  }
  return formData;
}

function deleteForm(roleId = 'role-1', roleName = 'Senior Tutor') {
  const formData = new FormData();
  formData.set('roleId', roleId);
  formData.set('roleName', roleName);
  return formData;
}

beforeEach(() => {
  savedGatewayUrl = process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = GATEWAY_URL;
  revalidatePath.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  if (savedGatewayUrl === undefined) {
    delete process.env.GATEWAY_API_URL;
  } else {
    process.env.GATEWAY_API_URL = savedGatewayUrl;
  }
});

describe('updateTenantRole', () => {
  it('sends PUT with the edited fields and revalidates the roles list', async () => {
    installFetch(success({ id: 'role-1' }));

    const state = await updateTenantRole(EMPTY_STATE, updateForm());

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(ROLE_PATH);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Senior Tutor',
      description: 'Leads tutors',
      permission_ids: ['perm-1', 'perm-2'],
    });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer session-token');
    expect((init.headers as Record<string, string>)['X-Tenant-ID']).toBe('tenant-1');
    expect(state.success).toBe(true);
    expect(state.message).toBe('Role "Senior Tutor" was updated successfully.');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/roles');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant');
  });

  it('applies the creation rules and does not call the backend on invalid input', async () => {
    installFetch(success());

    const state = await updateTenantRole(EMPTY_STATE, updateForm({ name: '   ' }, []));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.success).toBe(false);
    expect(state.errors?.name?.[0]).toBe('Role name is required.');
    expect(state.errors?.permissionIds?.[0]).toBe(
      'At least one permission must be selected for the role.'
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects a name longer than the creation form allows', async () => {
    installFetch(success());

    const state = await updateTenantRole(EMPTY_STATE, updateForm({ name: 'x'.repeat(51) }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.errors?.name?.[0]).toBe('Role name must not exceed 50 characters.');
  });

  it('maps 403 to a forbidden message', async () => {
    installFetch(failure(403, 'Permission denied'));

    const state = await updateTenantRole(EMPTY_STATE, updateForm());

    expect(state.success).toBe(false);
    expect(state.message).toBe('You do not have permission to edit this role.');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps 404 to a role-no-longer-exists message', async () => {
    installFetch(failure(404, 'role not found'));

    const state = await updateTenantRole(EMPTY_STATE, updateForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('This role no longer exists');
    expect(state.message).toContain('another session');
  });

  it('keeps the backend 409 name-conflict message', async () => {
    installFetch(failure(409, 'role with this name already exists in tenant'));

    const state = await updateTenantRole(EMPTY_STATE, updateForm());

    expect(state.success).toBe(false);
    expect(state.message).toBe('role with this name already exists in tenant');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('explains a 409 name conflict even when the body is not JSON', async () => {
    installFetch(new Response('conflict', { status: 409 }));

    const state = await updateTenantRole(EMPTY_STATE, updateForm());

    expect(state.message).toBe('Another role already uses this name. Choose a different name.');
  });

  it('reports a network failure without claiming success', async () => {
    fetchMock = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    vi.stubGlobal('fetch', fetchMock);

    const state = await updateTenantRole(EMPTY_STATE, updateForm());

    expect(state.success).toBe(false);
    expect(state.message).toBe('An unexpected network error occurred while updating the role.');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deleteTenantRole', () => {
  it('sends DELETE and revalidates the roles list on success', async () => {
    installFetch(success());

    const state = await deleteTenantRole(EMPTY_STATE, deleteForm());

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(ROLE_PATH);
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('DELETE');
    expect(state.success).toBe(true);
    expect(state.message).toBe('Role "Senior Tutor" was deleted successfully.');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/roles');
  });

  it('shows the backend 409 message for a role still assigned to members and keeps the list', async () => {
    installFetch(
      failure(409, 'cannot delete role because it is currently assigned to active members')
    );

    const state = await deleteTenantRole(EMPTY_STATE, deleteForm());

    expect(state.success).toBe(false);
    expect(state.message).toBe(
      'cannot delete role because it is currently assigned to active members'
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('explains a 409 in-use refusal even when the body has no message', async () => {
    installFetch(jsonResponse(409, { status: 'error' }));

    const state = await deleteTenantRole(EMPTY_STATE, deleteForm());

    expect(state.message).toBe(
      'This role is still assigned to active members and cannot be deleted.'
    );
  });

  it('maps 403 to a forbidden message', async () => {
    installFetch(failure(403, 'Permission denied'));

    const state = await deleteTenantRole(EMPTY_STATE, deleteForm());

    expect(state.success).toBe(false);
    expect(state.message).toBe('You do not have permission to delete this role.');
  });

  it('maps 404 (deleted in another session) to a role-no-longer-exists message', async () => {
    installFetch(failure(404, 'role not found'));

    const state = await deleteTenantRole(EMPTY_STATE, deleteForm());

    expect(state.success).toBe(false);
    expect(state.message).toContain('This role no longer exists');
  });

  it('refuses without a role id and does not call the backend', async () => {
    installFetch(success());

    const state = await deleteTenantRole(EMPTY_STATE, deleteForm(''));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.success).toBe(false);
    expect(state.message).toBe('Role ID is required.');
  });
});
