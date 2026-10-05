import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the parent review Server Action (KEL-160).
 *
 * The action cannot reach its real collaborators here: `next/headers` needs a
 * request scope, `next/cache` needs a render scope, and the request goes out
 * over `fetch`. All three are replaced, and what is asserted is the observable
 * contract the acceptance criteria depend on:
 *
 * - the exact method, path, headers and body the gateway receives. The body
 *   must be exactly `domain.ReviewRequest` (`{"rating","comment"}`), read from
 *   the academic `review.go`/`review_handler.go`, not from the client's own
 *   shape: the enrollment travels in the URL path and the parent in the
 *   verified session, so nothing else may influence which row is written.
 * - client validation (rating range, rune-capped comment, UUID shape) never
 *   reaches the network,
 * - a `404` is reported as ineligibility the parent can act on (foreign
 *   enrollment or a status outside active/completed),
 * - a successful save revalidates the enrollment screen,
 * - no message ever carries the raw server error text.
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

const { saveEnrollmentReview } = await import('./review-actions');
const { EMPTY_REVIEW_STATE } = await import('@/lib/reviews');

const GATEWAY_URL = 'http://gateway.test';
const ENROLLMENT_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const REVIEW_PATH = `${GATEWAY_URL}/api/v1/enrollments/${ENROLLMENT_ID}/review`;

function success() {
  return new Response(JSON.stringify({ status: 'success', message: 'Review saved', data: null }), {
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

function formDataOf(rating: string, comment: string, enrollmentId = ENROLLMENT_ID): FormData {
  const formData = new FormData();
  formData.set('enrollment_id', enrollmentId);
  formData.set('rating', rating);
  formData.set('comment', comment);
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

describe('saveEnrollmentReview', () => {
  it('puts the exact ReviewRequest body to the academic review route with the session bearer token', async () => {
    installFetch(success());

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('4', 'Kelasnya bagus.'));

    expect(state.status).toBe('success');
    const { url, init } = lastRequest();
    expect(url).toBe(REVIEW_PATH);
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${PARENT_TOKEN}`);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    // The exact contract the academic handler binds: rating + comment only.
    // The enrollment travels in the URL path, the parent in the session, so
    // the browser supplies no identifier beyond the enrollment id and no
    // status, class id, or parent id can influence the write.
    expect(JSON.parse(String(init.body))).toEqual({ rating: 4, comment: 'Kelasnya bagus.' });
  });

  it('sends an empty comment as an empty string, matching the optional backend field', async () => {
    installFetch(success());

    await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', ''));

    expect(JSON.parse(String(lastRequest().init.body))).toEqual({ rating: 5, comment: '' });
  });

  it('revalidates the enrollment screen so the row is re-rendered from the backend', async () => {
    installFetch(success());

    await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', 'Bagus'));

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/parent/enrollments');
  });

  it('never reaches the network for an identifier that is not a UUID', async () => {
    installFetch(success());

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', 'Bagus', 'not-a-uuid'));

    expect(state.status).toBe('error');
    expect(state.message).toContain('ID enrollment tidak valid');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(['0', '6', '', 'bagus'])('never reaches the network for an invalid rating %j', async (rating) => {
    installFetch(success());

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf(rating, 'Bagus'));

    expect(state.status).toBe('error');
    expect(state.message).toContain('rating');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never reaches the network for a comment longer than the backend allows', async () => {
    installFetch(success());

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', 'a'.repeat(2001)));

    expect(state.status).toBe('error');
    expect(state.message).toContain('maksimal');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to act without a parent session', async () => {
    authToken = NON_PARENT_TOKEN;
    installFetch(success());

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', 'Bagus'));

    expect(state.status).toBe('error');
    expect(state.message).toContain('Sesi parent tidak valid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to act when there is no session cookie at all', async () => {
    authToken = undefined;
    installFetch(success());

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', 'Bagus'));

    expect(state.status).toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explains a 404 as ineligibility and does not revalidate', async () => {
    // A foreign enrollment, or one whose status is outside active/completed.
    // The academic service scopes the lookup to the caller, so this answers
    // 404 rather than confirming the row exists.
    installFetch(failure(404, 'Eligible enrollment not found'));

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', 'Bagus'));

    expect(state.status).toBe('error');
    expect(state.message).toContain('belum memenuhi syarat');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('treats a 2xx envelope that reports an error as a failure', async () => {
    installFetch(
      new Response(JSON.stringify({ status: 'error', message: 'no', data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', 'Bagus'));

    expect(state.status).toBe('error');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('never surfaces the raw server error text', async () => {
    installFetch(
      failure(500, 'failed to save review: ERROR: deadlock detected (SQLSTATE 40P01)')
    );

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', 'Bagus'));

    expect(state.status).toBe('error');
    expect(state.message).not.toContain('SQLSTATE');
    expect(state.message).not.toContain('deadlock');
  });

  it('reports an unconfigured gateway without attempting a request', async () => {
    delete process.env.GATEWAY_API_URL;
    installFetch(success());

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', 'Bagus'));

    expect(state.status).toBe('error');
    expect(state.message).toContain('GATEWAY_API_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a network failure instead of throwing', async () => {
    fetchMock = vi.fn(async () => {
      throw new Error('socket hang up');
    });
    vi.stubGlobal('fetch', fetchMock);

    const state = await saveEnrollmentReview(EMPTY_REVIEW_STATE, formDataOf('5', 'Bagus'));

    expect(state.status).toBe('error');
    expect(state.message.length).toBeGreaterThan(0);
  });
});
