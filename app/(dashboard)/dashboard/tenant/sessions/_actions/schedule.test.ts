import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the reschedule and substitute-tutor Server Actions
 * (KEL-138).
 *
 * The actions cannot reach their real collaborators here: `next/headers`
 * needs a request scope, `next/cache` needs a render scope, and the writes
 * go out over `fetch`. All three are replaced, and what is asserted is the
 * observable contract the acceptance criteria depend on:
 *
 * - the request is addressed at the id route and the body still carries
 *   `session_id` (the `RescheduleSessionRequest`/`SubstituteTutorRequest`
 *   payloads require it),
 * - an invalid identifier or payload never reaches the network,
 * - a backend refusal (400/403/404/409) is reported as a member-safe
 *   Indonesian message that carries no raw server text,
 * - a successful write revalidates the screen so the refresh reads the new
 *   date and the replacement tutor back from the backend.
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

const { rescheduleSession, assignSubstituteTutor } = await import('./schedule');
const { TENANT_SESSIONS_PATH } = await import('../_lib/schema');

const GATEWAY_URL = 'http://gateway.test';
const SESSION_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const TUTOR_ID = 'aaaaaaaa-1111-4222-8333-444455556666';

const EMPTY_STATE = { success: false, message: '' };

function rescheduleForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set('session_id', SESSION_ID);
  data.set('new_session_date', '2999-10-05');
  data.set('new_start_time', '15:30');
  data.set('new_end_time', '17:00');
  for (const [key, value] of Object.entries(overrides)) {
    data.set(key, value);
  }
  return data;
}

function substituteForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set('session_id', SESSION_ID);
  data.set('substitute_tutor_id', TUTOR_ID);
  for (const [key, value] of Object.entries(overrides)) {
    data.set(key, value);
  }
  return data;
}

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  );
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

describe('rescheduleSession', () => {
  it('posts to the id route with session_id in the body and revalidates', async () => {
    respondWith(200, { status: 'success', message: 'ok', data: {} });

    const result = await rescheduleSession(EMPTY_STATE, rescheduleForm());

    expect(result.success).toBe(true);
    expect(result.message).toContain('reschedule');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GATEWAY_URL}/api/v1/sessions/${SESSION_ID}/reschedule`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      session_id: SESSION_ID,
      new_session_date: '2999-10-05',
      new_start_time: '15:30',
      new_end_time: '17:00',
    });
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_SESSIONS_PATH);
  });

  it('rejects an invalid payload without calling the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Must not reach the network');
      })
    );

    for (const form of [
      rescheduleForm({ session_id: 'not-a-uuid' }),
      rescheduleForm({ new_session_date: '05-10-2999' }),
      rescheduleForm({ new_start_time: '17:00', new_end_time: '15:30' }),
      rescheduleForm({ new_session_date: '2000-01-01' }),
    ]) {
      const result = await rescheduleSession(EMPTY_STATE, form);

      expect(result.success).toBe(false);
    }

    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps backend refusals to member-safe messages without the raw text', async () => {
    const cases: { status: number; message: RegExp }[] = [
      { status: 400, message: /tidak valid/ },
      { status: 403, message: /izin/ },
      { status: 404, message: /tidak ditemukan|Muat ulang/ },
      { status: 409, message: /bertentangan/ },
    ];

    for (const { status, message } of cases) {
      respondWith(status, { status: 'error', message: 'backend-boom', data: null });

      const result = await rescheduleSession(EMPTY_STATE, rescheduleForm());

      expect(result.success).toBe(false);
      expect(result.message).toMatch(message);
      expect(JSON.stringify(result)).not.toContain('backend-boom');
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;

    const result = await rescheduleSession(EMPTY_STATE, rescheduleForm());

    expect(result.success).toBe(false);
    expect(result.message).toContain('GATEWAY_API_URL');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('assignSubstituteTutor', () => {
  it('patches the id route with session_id in the body and revalidates', async () => {
    respondWith(200, { status: 'success', message: 'ok', data: {} });

    const result = await assignSubstituteTutor(EMPTY_STATE, substituteForm());

    expect(result.success).toBe(true);
    expect(result.message).toContain('pengganti');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GATEWAY_URL}/api/v1/sessions/${SESSION_ID}/substitute-tutor`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({
      session_id: SESSION_ID,
      substitute_tutor_id: TUTOR_ID,
    });
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_SESSIONS_PATH);
  });

  it('rejects an invalid tutor id without calling the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Must not reach the network');
      })
    );

    for (const form of [
      substituteForm({ substitute_tutor_id: 'guru-1' }),
      substituteForm({ session_id: 'sesi-1' }),
    ]) {
      const result = await assignSubstituteTutor(EMPTY_STATE, form);

      expect(result.success).toBe(false);
      expect(result.message).toContain('tidak valid');
    }

    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps an invalid-tutor refusal to a member-safe message without the raw text', async () => {
    respondWith(400, { status: 'error', message: 'substitute tutor not eligible', data: null });

    const result = await assignSubstituteTutor(EMPTY_STATE, substituteForm());

    expect(result.success).toBe(false);
    expect(result.message).toContain('tidak valid');
    expect(JSON.stringify(result)).not.toContain('not eligible');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps a missing session or tutor to a refresh-safe hint', async () => {
    respondWith(404, { status: 'error', message: 'gone', data: null });

    const result = await assignSubstituteTutor(EMPTY_STATE, substituteForm());

    expect(result.success).toBe(false);
    expect(result.message).toContain('tidak ditemukan');
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;

    const result = await assignSubstituteTutor(EMPTY_STATE, substituteForm());

    expect(result.success).toBe(false);
    expect(result.message).toContain('GATEWAY_API_URL');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
