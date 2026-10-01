import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the mass attendance Server Action (KEL-137).
 *
 * The action cannot reach its real collaborators here: `next/headers`
 * needs a request scope, `next/cache` needs a render scope, and the saves
 * go out over `fetch`. All three are replaced, and what is asserted is the
 * observable contract the acceptance criteria depend on:
 *
 * - every row is saved with its own `POST /api/v1/attendance` addressed at
 *   `{ enrollment_id, session_id, status }` — the gateway registers no
 *   `/attendance/bulk` route, so no bulk request is ever sent,
 * - the browser supplies only the session id and the per-row statuses while
 *   the tenant is derived from the session,
 * - an invalid identifier or payload never reaches the network,
 * - a repeated save (`409`) reads as already recorded rather than failed,
 * - a partial failure reports per-row outcomes so only the failed rows need
 *   another attempt,
 * - a successful save revalidates the screen so the refresh reads the
 *   recorded states back from the backend,
 * - no message ever carries the raw server error text.
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

const { saveSessionAttendance } = await import('./attendance');
const { TENANT_SESSIONS_PATH } = await import('../_lib/schema');

const GATEWAY_URL = 'http://gateway.test';
const SESSION_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const ENROLLMENT_ID = 'c0ffee00-1111-4222-8333-444455556666';
const SECOND_ENROLLMENT_ID = 'd1ffee00-1111-4222-8333-444455556666';
const SAVE_PATH = `${GATEWAY_URL}/api/v1/attendance`;

const EMPTY_STATE = { success: false, message: '', results: [], forbidden: false };

function formData(sessionId: string, entries: unknown): FormData {
  const data = new FormData();
  data.set('session_id', sessionId);
  data.set('entries', typeof entries === 'string' ? entries : JSON.stringify(entries));
  return data;
}

function entriesOf(count = 2) {
  return [
    { enrollment_id: ENROLLMENT_ID, status: 'present' },
    ...(count > 1 ? [{ enrollment_id: SECOND_ENROLLMENT_ID, status: 'late' }] : []),
  ];
}

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  );
}

function respondWithRoute(route: (url: string, init: RequestInit) => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => route(String(input), init ?? {}))
  );
}

function lastSaveBodies(): Record<string, unknown>[] {
  const fetchMock = vi.mocked(fetch);
  return fetchMock.mock.calls
    .filter(([input]) => String(input) === SAVE_PATH)
    .map(([, init]) => JSON.parse(String((init as RequestInit)?.body)));
}

function lastSaveHeaders(): Record<string, string> {
  const fetchMock = vi.mocked(fetch);
  const call = fetchMock.mock.calls.find(([input]) => String(input) === SAVE_PATH);

  return (call?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
}

let savedGatewayUrl: string | undefined;

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

describe('saveSessionAttendance', () => {
  it('saves every row with its own session-addressed request and revalidates', async () => {
    respondWithRoute((url) => {
      if (url === SAVE_PATH) {
        return new Response(JSON.stringify({ status: 'success', data: { id: 'att-1' } }), {
          status: 201,
        });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    });

    const result = await saveSessionAttendance(EMPTY_STATE, formData(SESSION_ID, entriesOf(2)));

    expect(result.success).toBe(true);
    expect(result.forbidden).toBe(false);
    expect(result.message).toContain('2 siswa');
    expect(result.results).toEqual([
      { enrollmentId: ENROLLMENT_ID, outcome: 'saved', message: null },
      { enrollmentId: SECOND_ENROLLMENT_ID, outcome: 'saved', message: null },
    ]);

    // One request per row — never a bulk request the gateway would 404.
    expect(vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === SAVE_PATH)).toHaveLength(2);
    expect(
      vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes('/bulk'))
    ).toBe(false);
    expect(lastSaveBodies()).toEqual([
      { enrollment_id: ENROLLMENT_ID, session_id: SESSION_ID, status: 'present' },
      { enrollment_id: SECOND_ENROLLMENT_ID, session_id: SESSION_ID, status: 'late' },
    ]);
    expect(lastSaveHeaders()).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_SESSIONS_PATH);
  });

  it('reports a repeated save as already recorded rather than failed', async () => {
    respondWith(409, { status: 'error', message: 'Attendance already exists', data: null });

    const result = await saveSessionAttendance(EMPTY_STATE, formData(SESSION_ID, entriesOf(1)));

    expect(result.success).toBe(true);
    expect(result.results).toEqual([
      { enrollmentId: ENROLLMENT_ID, outcome: 'already_saved', message: 'Sudah tercatat sebelumnya.' },
    ]);
    expect(result.message).toContain('sudah tercatat');
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_SESSIONS_PATH);
  });

  it('reports a partial failure per row without losing the saved rows', async () => {
    respondWithRoute((url, init) => {
      if (url === SAVE_PATH) {
        const body = JSON.parse(String(init.body));

        if (body.enrollment_id === ENROLLMENT_ID) {
          return new Response(JSON.stringify({ status: 'success', data: { id: 'att-1' } }), {
            status: 201,
          });
        }

        return new Response(JSON.stringify({ status: 'error', message: 'boom', data: null }), {
          status: 500,
        });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    });

    const result = await saveSessionAttendance(EMPTY_STATE, formData(SESSION_ID, entriesOf(2)));

    expect(result.success).toBe(false);
    expect(result.forbidden).toBe(false);
    expect(result.message).toContain('Sebagian');
    expect(result.results).toEqual([
      { enrollmentId: ENROLLMENT_ID, outcome: 'saved', message: null },
      {
        enrollmentId: SECOND_ENROLLMENT_ID,
        outcome: 'failed',
        message: 'Kehadiran belum dapat disimpan. Coba lagi nanti.',
      },
    ]);
    // The raw server text must not leak into the member's screen.
    expect(JSON.stringify(result)).not.toContain('boom');
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_SESSIONS_PATH);
  });

  it('presents a member without attendance:create as forbidden, not as a technical error', async () => {
    respondWithRoute((url) => {
      if (url === SAVE_PATH) {
        return new Response(JSON.stringify({ status: 'error', message: 'forbidden', data: null }), {
          status: 403,
        });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/attendance?`)) {
        return new Response(JSON.stringify({ status: 'error', message: 'forbidden', data: null }), {
          status: 403,
        });
      }
      throw new Error(`Unexpected request in test: ${url}`);
    });

    const result = await saveSessionAttendance(EMPTY_STATE, formData(SESSION_ID, entriesOf(1)));

    expect(result.success).toBe(false);
    expect(result.forbidden).toBe(true);
    expect(result.message).toContain('attendance:create');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid session id without calling the backend', async () => {
    respondWithRoute(() => {
      throw new Error('Must not reach the network');
    });

    const result = await saveSessionAttendance(EMPTY_STATE, formData('not-a-uuid', entriesOf(1)));

    expect(result.success).toBe(false);
    expect(result.message).toContain('ID sesi tidak valid');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a tampered payload without calling the backend', async () => {
    respondWithRoute(() => {
      throw new Error('Must not reach the network');
    });

    for (const entries of [
      'not json',
      JSON.stringify({ enrollment_id: ENROLLMENT_ID }),
      JSON.stringify([{ enrollment_id: ENROLLMENT_ID, status: 'hadiir' }]),
      JSON.stringify([{ enrollment_id: 'not-a-uuid', status: 'present' }]),
    ]) {
      const result = await saveSessionAttendance(EMPTY_STATE, formData(SESSION_ID, entries));

      expect(result.success).toBe(false);
      expect(result.message).toContain('tidak valid');
    }

    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses an empty session instead of sending a request the backend rejects', async () => {
    respondWithRoute(() => {
      throw new Error('Must not reach the network');
    });

    const result = await saveSessionAttendance(EMPTY_STATE, formData(SESSION_ID, []));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Belum ada siswa');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps a missing session to a refresh hint instead of a technical error', async () => {
    respondWithRoute((url) => {
      if (url === SAVE_PATH) {
        return new Response(JSON.stringify({ status: 'error', message: 'gone', data: null }), {
          status: 404,
        });
      }
      return new Response(JSON.stringify({ status: 'success', data: { items: [], pagination: {} } }), {
        status: 200,
      });
    });

    const result = await saveSessionAttendance(EMPTY_STATE, formData(SESSION_ID, entriesOf(1)));

    expect(result.success).toBe(false);
    expect(result.results[0].outcome).toBe('failed');
    expect(result.results[0].message).toContain('Muat ulang');
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;

    const result = await saveSessionAttendance(EMPTY_STATE, formData(SESSION_ID, entriesOf(1)));

    expect(result.success).toBe(false);
    expect(result.message).toContain('GATEWAY_API_URL');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
