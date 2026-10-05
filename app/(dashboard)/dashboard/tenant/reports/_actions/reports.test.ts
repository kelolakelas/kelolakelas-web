import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the report Server Actions (KEL-139).
 *
 * The actions cannot reach their real collaborators here: `next/headers`
 * needs a request scope, `next/cache` needs a render scope, and the writes
 * go out over `fetch`. All three are replaced, and what is asserted is the
 * observable contract the acceptance criteria depend on:
 *
 * - the request is addressed at the reports route and the body carries the
 *   exact field names the backend binds (`enrollment_id`, `title`,
 *   `evaluation_notes`, `score` — never an enrollment on update),
 * - an invalid identifier or payload never reaches the network,
 * - a backend refusal (400/403/404) is reported as a member-safe
 *   Indonesian message that carries no raw server text — including the
 *   "tutor is not assigned" 403 a tutor meets on another class's report,
 * - a successful write revalidates the screen so the refresh reads the new
 *   title and score back from the backend.
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

const { createTenantReport, updateTenantReport, deleteTenantReport } = await import('./reports');
const { TENANT_REPORTS_PATH } = await import('../_lib/schema');

const GATEWAY_URL = 'http://gateway.test';
const REPORT_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const ENROLLMENT_ID = 'c0ffee00-1111-4222-8333-444455556666';

const EMPTY_STATE = { success: false, message: '' };

function createForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set('enrollment_id', ENROLLMENT_ID);
  data.set('title', 'Evaluasi tengah semester');
  data.set('evaluation_notes', 'Perkembangan baik.');
  data.set('score', '85');
  for (const [key, value] of Object.entries(overrides)) {
    data.set(key, value);
  }
  return data;
}

function updateForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set('report_id', REPORT_ID);
  data.set('title', 'Evaluasi revisi');
  data.set('evaluation_notes', 'Catatan revisi.');
  data.set('score', '90');
  for (const [key, value] of Object.entries(overrides)) {
    data.set(key, value);
  }
  return data;
}

function deleteForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set('report_id', REPORT_ID);
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

describe('createTenantReport', () => {
  it('posts the exact backend body and revalidates', async () => {
    respondWith(201, { status: 'success', message: 'ok', data: {} });

    const result = await createTenantReport(EMPTY_STATE, createForm());

    expect(result.success).toBe(true);
    expect(result.message).toContain('berhasil dibuat');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GATEWAY_URL}/api/v1/reports`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      enrollment_id: ENROLLMENT_ID,
      title: 'Evaluasi tengah semester',
      evaluation_notes: 'Perkembangan baik.',
      score: 85,
    });
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_REPORTS_PATH);
  });

  it('rejects an invalid payload without calling the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Must not reach the network');
      })
    );

    for (const form of [
      createForm({ enrollment_id: 'siswa-1' }),
      createForm({ title: '   ' }),
      createForm({ score: '101' }),
      createForm({ score: '-1' }),
    ]) {
      const result = await createTenantReport(EMPTY_STATE, form);

      expect(result.success).toBe(false);
    }

    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps backend refusals to member-safe messages without the raw text', async () => {
    const cases: { status: number; message: RegExp }[] = [
      { status: 400, message: /tidak valid/ },
      { status: 403, message: /izin|bukan siswa yang Anda ajar/ },
      { status: 404, message: /tidak ditemukan|Muat ulang/ },
    ];

    for (const { status, message } of cases) {
      respondWith(status, { status: 'error', message: 'Tutor is not assigned to this enrollment', data: null });

      const result = await createTenantReport(EMPTY_STATE, createForm());

      expect(result.success).toBe(false);
      expect(result.message).toMatch(message);
      expect(JSON.stringify(result)).not.toContain('Tutor is not assigned');
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;

    const result = await createTenantReport(EMPTY_STATE, createForm());

    expect(result.success).toBe(false);
    expect(result.message).toContain('GATEWAY_API_URL');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('updateTenantReport', () => {
  it('patches the id route with no enrollment field and revalidates', async () => {
    respondWith(200, { status: 'success', message: 'ok', data: {} });

    const result = await updateTenantReport(EMPTY_STATE, updateForm());

    expect(result.success).toBe(true);
    expect(result.message).toContain('diperbarui');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GATEWAY_URL}/api/v1/reports/${REPORT_ID}`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({
      title: 'Evaluasi revisi',
      evaluation_notes: 'Catatan revisi.',
      score: 90,
    });
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_REPORTS_PATH);
  });

  it('rejects an invalid update without calling the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Must not reach the network');
      })
    );

    for (const form of [
      updateForm({ report_id: 'laporan-1' }),
      updateForm({ title: '' }),
      updateForm({ score: '150' }),
    ]) {
      const result = await updateTenantReport(EMPTY_STATE, form);

      expect(result.success).toBe(false);
    }

    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('tells a tutor without the assignment that only the class tutor may change it', async () => {
    respondWith(403, { status: 'error', message: 'Tutor is not assigned to this enrollment', data: null });

    const result = await updateTenantReport(EMPTY_STATE, updateForm());

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Hanya pengajar kelas/);
    expect(JSON.stringify(result)).not.toContain('Tutor is not assigned');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('deleteTenantReport', () => {
  it('deletes at the id route and revalidates', async () => {
    respondWith(200, { status: 'success', message: 'ok', data: null });

    const result = await deleteTenantReport(EMPTY_STATE, deleteForm());

    expect(result.success).toBe(true);
    expect(result.message).toContain('dihapus');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GATEWAY_URL}/api/v1/reports/${REPORT_ID}`);
    expect(init.method).toBe('DELETE');
    expect(revalidatePath).toHaveBeenCalledWith(TENANT_REPORTS_PATH);
  });

  it('rejects an invalid report id without calling the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Must not reach the network');
      })
    );

    const result = await deleteTenantReport(EMPTY_STATE, deleteForm({ report_id: 'laporan-1' }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('tidak valid');
    expect(fetch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('maps a forbidden delete to the assignment message without the raw text', async () => {
    respondWith(403, { status: 'error', message: 'Tutor is not assigned to this enrollment', data: null });

    const result = await deleteTenantReport(EMPTY_STATE, deleteForm());

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Hanya pengajar kelas/);
    expect(JSON.stringify(result)).not.toContain('Tutor is not assigned');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
