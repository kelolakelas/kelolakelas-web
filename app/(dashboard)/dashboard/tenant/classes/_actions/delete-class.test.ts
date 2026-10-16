import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({
  token: 'session-token',
  revalidate: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      name === 'auth_token' && auth.token ? { value: auth.token } : undefined,
  })),
}));
vi.mock('next/cache', () => ({ revalidatePath: auth.revalidate }));
import { deleteClass } from './classActions';
const id = '9b9ee145-f561-4acb-b231-6d22d076369c';
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  auth.token = 'session-token';
  vi.stubEnv('GATEWAY_API_URL', 'http://gateway.test');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const response = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });
it('sends only an authenticated DELETE to the existing class endpoint and revalidates after success', async () => {
  fetchMock.mockResolvedValue(response(200, { status: 'success' }));
  expect(await deleteClass(id)).toMatchObject({ success: true });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe(`http://gateway.test/api/v1/classes/${id}`);
  expect(options.method).toBe('DELETE');
  expect(options.body).toBeUndefined();
  expect(options.headers.get('Authorization')).toBe('Bearer session-token');
  expect(auth.revalidate.mock.calls.map((call) => call[0])).toEqual([
    '/dashboard/tenant/classes',
    '/dashboard/tenant/sessions',
    '/kelas',
  ]);
});
it.each([
  [401, /session has expired/],
  [403, /permission to delete/],
  [404, /no longer available/],
  [409, /active enrollments/],
  [503, /Permission could not be verified/],
  [500, /could not be confirmed/],
] as const)(
  'maps %s without refreshing or reporting success',
  async (status, message) => {
    fetchMock.mockResolvedValue(
      response(status, { status: 'error', message: 'internal detail' }),
    );
    const result = await deleteClass(id);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(message);
    expect(auth.revalidate).not.toHaveBeenCalled();
  },
);
it.each(['network', 'malformed', 'false-success'])(
  'keeps %s uncertainty as failure with no refresh',
  async (mode) => {
    if (mode === 'network') fetchMock.mockRejectedValue(new Error('network'));
    else
      fetchMock.mockResolvedValue(
        mode === 'malformed'
          ? new Response('bad', { status: 200 })
          : response(200, { status: 'error' }),
      );
    expect((await deleteClass(id)).success).toBe(false);
    expect(auth.revalidate).not.toHaveBeenCalled();
  },
);
it('rejects invalid IDs or missing authentication before network access', async () => {
  expect((await deleteClass('../all')).success).toBe(false);
  auth.token = '';
  expect((await deleteClass(id)).success).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
