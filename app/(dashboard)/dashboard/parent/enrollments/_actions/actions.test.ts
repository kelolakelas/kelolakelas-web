import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the parent enrollment cancellation Server Action
 * (KEL-45).
 *
 * The action cannot reach its real collaborators here: `next/headers` needs a
 * request scope, `next/cache` needs a render scope, and the request goes out
 * over `fetch`. All three are replaced, and what is asserted is the observable
 * contract the acceptance criteria depend on:
 *
 * - the exact method, path and headers the gateway receives, including that the
 *   request carries no body and no identifier beyond the enrollment id,
 * - that an invalid identifier never reaches the network,
 * - that `409` is reported as a refusal the parent can act on,
 * - that a successful cancellation revalidates the screen so the row is
 *   re-rendered from the backend rather than from an optimistic guess,
 * - that no message ever carries the raw server error text.
 *
 * `next/headers`, `next/cache`, and the gateway helper are mocked through
 * `vi.mock` rather than by stubbing globals because the action imports them by
 * module path.
 */

const PARENT_TOKEN = [
  'header',
  Buffer.from(JSON.stringify({ user_id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11', is_parent: true }))
    .toString('base64url'),
  'signature',
].join('.');

const NON_PARENT_TOKEN = [
  'header',
  Buffer.from(JSON.stringify({ user_id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11', is_parent: false }))
    .toString('base64url'),
  'signature',
].join('.');

let authToken: string | undefined = PARENT_TOKEN;

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'auth_token' && authToken ? { name, value: authToken } : undefined),
  })),
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidatePath(path) }));

const { cancelPendingEnrollment } = await import('./actions');
const { EMPTY_ENROLLMENT_CANCELLATION_STATE } = await import('@/lib/enrollment-cancellation');

const GATEWAY_URL = 'http://gateway.test';
const ENROLLMENT_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const CANCEL_PATH = `${GATEWAY_URL}/api/v1/enrollments/${ENROLLMENT_ID}/cancel`;

function success(data: unknown = { id: ENROLLMENT_ID, status: 'dropped' }) {
  return new Response(JSON.stringify({ status: 'success', message: 'Enrollment cancelled successfully', data }), {
    status: 200,
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

function installFetch(response: Response | (() => Response)) {
  fetchMock = vi.fn(async () => (typeof response === 'function' ? response() : response));
  vi.stubGlobal('fetch', fetchMock);
}

function formDataOf(enrollmentId: string): FormData {
  const formData = new FormData();
  formData.set('enrollment_id', enrollmentId);
  return formData;
}

function lastRequest(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

beforeEach(() => {
  savedGatewayUrl = process.env.GATEWAY_API_URL;
  process.env.GATEWAY_API_URL = GATEWAY_URL;
  authToken = PARENT_TOKEN;
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

describe('cancelPendingEnrollment', () => {
  it('posts the enrollment id to the academic cancel route with the session bearer token', async () => {
    installFetch(success());

    const state = await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf(ENROLLMENT_ID));

    expect(state.status).toBe('success');
    const { url, init } = lastRequest();
    expect(url).toBe(CANCEL_PATH);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${PARENT_TOKEN}`);
    // The browser supplies the identifier and nothing else: no parent id, no
    // status, and no price can influence which enrollment is withdrawn.
    expect(init.body).toBeUndefined();
  });

  it('revalidates the screen so the row is re-rendered from the backend', async () => {
    installFetch(success());

    await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf(ENROLLMENT_ID));

    // Without this the parent would keep seeing a cancellable row that the
    // backend has already dropped.
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/parent/enrollments');
  });

  it('never reaches the network for an identifier that is not a UUID', async () => {
    installFetch(success());

    const state = await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf('not-a-uuid'));

    expect(state.status).toBe('error');
    expect(state.message).toContain('ID enrollment tidak valid');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses to act without a parent session', async () => {
    authToken = NON_PARENT_TOKEN;
    installFetch(success());

    const state = await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf(ENROLLMENT_ID));

    expect(state.status).toBe('error');
    expect(state.message).toContain('Sesi parent tidak valid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to act when there is no session cookie at all', async () => {
    authToken = undefined;
    installFetch(success());

    const state = await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf(ENROLLMENT_ID));

    expect(state.status).toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains a 409 refusal and does not revalidate', async () => {
    // A paid-after-cancel or already-started enrollment. This is the outcome a
    // concurrent payment produces, and it must not read like an outage.
    installFetch(failure(409, 'Enrollment can no longer be cancelled'));

    const state = await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf(ENROLLMENT_ID));

    expect(state.status).toBe('error');
    expect(state.message).toContain('sudah diterima atau statusnya sudah berubah');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reports another parent\'s enrollment as not found', async () => {
    // The academic service scopes the lookup to the caller, so a foreign
    // enrollment answers 404 rather than confirming it exists.
    installFetch(failure(404, 'Enrollment not found'));

    const state = await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf(ENROLLMENT_ID));

    expect(state.status).toBe('error');
    expect(state.message).toContain('tidak ditemukan');
  });

  it('treats a 2xx envelope that reports an error as a failure', async () => {
    installFetch(
      new Response(JSON.stringify({ status: 'error', message: 'no', data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const state = await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf(ENROLLMENT_ID));

    expect(state.status).toBe('error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('never surfaces the raw server error text', async () => {
    installFetch(
      failure(500, 'failed to withdraw transaction: ERROR: deadlock detected (SQLSTATE 40P01)')
    );

    const state = await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf(ENROLLMENT_ID));

    expect(state.status).toBe('error');
    expect(state.message).not.toContain('SQLSTATE');
    expect(state.message).not.toContain('deadlock');
  });

  it('reports an unconfigured gateway without attempting a request', async () => {
    delete process.env.GATEWAY_API_URL;
    installFetch(success());

    const state = await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf(ENROLLMENT_ID));

    expect(state.status).toBe('error');
    expect(state.message).toContain('GATEWAY_API_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a network failure instead of throwing', async () => {
    fetchMock = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    vi.stubGlobal('fetch', fetchMock);

    const state = await cancelPendingEnrollment(EMPTY_ENROLLMENT_CANCELLATION_STATE, formDataOf(ENROLLMENT_ID));

    expect(state.status).toBe('error');
    expect(state.message.length).toBeGreaterThan(0);
  });
});
