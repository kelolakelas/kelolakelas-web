import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListPagination } from '@/lib/list-envelope';

/**
 * Integration test for the tenant report readers (KEL-139, KEL-167).
 *
 * The module cannot reach its real collaborators here: `next/headers` needs
 * a request scope, and the gateway reads go out over `fetch`. Both are
 * replaced with stand-ins that keep the observable contract:
 *
 * - the cookie store answers the two cookie names the reader looks up,
 * - `fetch` is a stub routed by URL, so the test asserts exactly which
 *   academic requests a given page state produces.
 *
 * The behaviours pinned here are the ones the acceptance criteria name:
 * authorization failures surface as `forbidden` (not as a technical error),
 * the list carries only the vocabulary the backend `parseReportQuery`
 * understands, rows that fail normalisation are skipped rather than failing
 * the list, and — KEL-167 — the overview makes exactly one academic request
 * (no enrollment/session prefetch on page load): the create-form student
 * picker reads on demand through the exported search readers, one explicit
 * page per call, with the direct list (`enrollment:read`, Creator path) and
 * the taught-session lookup (`schedule:read`, Teacher path).
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

const { getTenantReports, searchDirectEnrollmentOptions, searchTaughtEnrollmentOptions } =
  await import('./queries');

const GATEWAY_URL = 'http://gateway.test';

const REPORT_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const ENROLLMENT_ID = 'c0ffee00-1111-4222-8333-444455556666';

function pagination(overrides: Partial<ListPagination> = {}): ListPagination {
  return { page: 1, page_size: 20, total_items: 1, total_pages: 1, ...overrides };
}

function success(data: unknown) {
  return new Response(JSON.stringify({ status: 'success', message: 'ok', data }), {
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

function reportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    enrollment_id: ENROLLMENT_ID,
    reporter_id: 'reporter-1',
    title: 'Evaluasi tengah semester',
    evaluation_notes: 'Perkembangan baik.',
    score: 85,
    created_at: '2026-09-30T10:00:00Z',
    enrollment: {
      id: ENROLLMENT_ID,
      student_id: 'student-1',
      class_id: 'class-1',
      status: 'active',
      student: { first_name: 'Budi', last_name: 'Santoso' },
      class: { id: 'class-1', name: 'Matematika Dasar' },
    },
    ...overrides,
  };
}

type Route = (url: string) => Response | undefined;

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(route: Route) {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const response = route(url);

    if (!response) {
      throw new Error(`Unexpected request in test: ${url}`);
    }

    return response;
  });

  vi.stubGlobal('fetch', fetchMock);
}

/** Requests the reader made, in order. */
function requestedPaths(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function headersOf(path: string): Record<string, string> {
  const call = fetchMock.mock.calls.find((entry) => String(entry[0]) === path);

  return (call?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
}

function reportsOnlyRoute(reports: unknown[]) {
  return (url: string) => {
    if (url.startsWith(`${GATEWAY_URL}/api/v1/reports?`)) {
      return success({ items: reports, pagination: pagination({ total_items: reports.length }) });
    }
    return undefined;
  };
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

describe('getTenantReports', () => {
  it('reads one page with the backend vocabulary and normalizes the rows', async () => {
    installFetch(reportsOnlyRoute([reportRow()]));

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.rows).toHaveLength(1);
    expect(result.data.rows[0]?.report.title).toBe('Evaluasi tengah semester');
    expect(result.data.rows[0]?.report.enrollment?.student?.first_name).toBe('Budi');

    // KEL-167: the overview makes exactly one academic request — no
    // enrollment/session prefetch on page load. The picker reads on demand.
    const paths = requestedPaths();
    expect(paths).toHaveLength(1);

    const reportsUrl = new URL(paths[0] as string);
    expect(reportsUrl.searchParams.get('page')).toBe('1');
    expect(reportsUrl.searchParams.get('page_size')).toBe('20');
    expect(reportsUrl.searchParams.has('class_id')).toBe(false);

    expect(headersOf(paths[0] as string)).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
  });

  it('forwards the search, enrollment, and date filters', async () => {
    installFetch(reportsOnlyRoute([]));

    await getTenantReports({
      search: 'evaluasi',
      enrollment_id: ENROLLMENT_ID,
      date_from: '2026-09-01',
      date_to: '2026-09-30',
    });

    const reportsUrl = new URL(requestedPaths()[0] as string);

    expect(reportsUrl.searchParams.get('search')).toBe('evaluasi');
    expect(reportsUrl.searchParams.get('enrollment_id')).toBe(ENROLLMENT_ID);
    expect(reportsUrl.searchParams.get('date_from')).toBe('2026-09-01');
    expect(reportsUrl.searchParams.get('date_to')).toBe('2026-09-30');
  });

  it('reports an invalid filter without calling the backend', async () => {
    installFetch(reportsOnlyRoute([reportRow()]));

    const result = await getTenantReports({ enrollment_id: 'siswa-1' });

    expect(result).toEqual({ data: null, error: 'invalid_filter' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces authorization failures as forbidden, not as a technical error', async () => {
    for (const status of [401, 403]) {
      installFetch(() => failure(status, 'forbidden'));

      const result = await getTenantReports({});

      expect(result.error).toBe('forbidden');
      if (result.error !== 'forbidden' || result.data !== null) {
        throw new Error('Expected a forbidden state without data');
      }
      expect(result.message).toMatch(/report:read/);
    }
  });

  it('reports a backend outage as an api error', async () => {
    installFetch(() => failure(500));

    const result = await getTenantReports({});

    expect(result.error).toBe('api');
  });

  it('skips rows that fail normalisation instead of failing the list', async () => {
    installFetch(reportsOnlyRoute([{ title: 'Tanpa id' }, reportRow()]));

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.rows).toHaveLength(1);
    expect(result.data.rows[0]?.report.id).toBe(REPORT_ID);
  });

  it('derives the filter options only from the rows on the page', async () => {
    installFetch(reportsOnlyRoute([reportRow()]));

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    // The filter select feeds from the page's own rows only; the create-form
    // options moved to the on-demand picker (KEL-167), so no auxiliary
    // request may go out here.
    expect(result.data.enrollments).toEqual([
      { enrollment_id: ENROLLMENT_ID, label: 'Budi Santoso · Matematika Dasar' },
    ]);
    expect(requestedPaths()).toHaveLength(1);
  });

  it('keeps an empty filter list without hiding the reports', async () => {
    installFetch(reportsOnlyRoute([]));

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.rows).toHaveLength(0);
    expect(result.data.enrollments).toEqual([]);
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;

    const result = await getTenantReports({});

    expect(result.error).toBe('configuration');
    if (result.error !== 'configuration' || result.data !== null) {
      throw new Error('Expected a configuration state without data');
    }
    expect(result.message).toContain('GATEWAY_API_URL');
  });
});

describe('searchDirectEnrollmentOptions', () => {
  it('reads one explicit page with the search text and the active status', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments?`)) {
        return success({
          items: [
            {
              id: ENROLLMENT_ID,
              class_id: 'class-1',
              student: { first_name: 'Budi', last_name: 'Santoso' },
              class: { id: 'class-1', name: 'Matematika Dasar' },
            },
          ],
          pagination: pagination({ total_items: 1 }),
        });
      }
      return undefined;
    });

    const result = await searchDirectEnrollmentOptions('budi', 1);

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.items).toEqual([
      {
        enrollment_id: ENROLLMENT_ID,
        label: 'Budi Santoso · Matematika Dasar',
        class_id: 'class-1',
        class_name: 'Matematika Dasar',
      },
    ]);
    expect(result.data.classes).toEqual([{ class_id: 'class-1', name: 'Matematika Dasar' }]);
    expect(result.data.partialFailures).toBe(0);

    const paths = requestedPaths();
    expect(paths).toHaveLength(1);

    const url = new URL(paths[0] as string);
    expect(url.searchParams.get('search')).toBe('budi');
    expect(url.searchParams.get('status')).toBe('active');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('page_size')).toBe('100');
  });

  it('sends no search parameter for a blank query', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments?`)) {
        return success({ items: [], pagination: pagination({ total_items: 0, total_pages: 0 }) });
      }
      return undefined;
    });

    const result = await searchDirectEnrollmentOptions('   ', 2);

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    const url = new URL(requestedPaths()[0] as string);
    expect(url.searchParams.has('search')).toBe(false);
    expect(url.searchParams.get('page')).toBe('2');
  });

  it('answers limit without a request past the backend page bound', async () => {
    installFetch(() => {
      throw new Error('Must not request past the page bound');
    });

    for (const page of [0, -1, 1001, Number.NaN]) {
      const result = await searchDirectEnrollmentOptions('budi', page);

      expect(result.error).toBe('limit');
      if (result.error !== 'limit' || result.data !== null) {
        throw new Error('Expected a limit state without data');
      }
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers forbidden when the caller lacks enrollment:read', async () => {
    installFetch(() => failure(403, 'enrollment:read required'));

    const result = await searchDirectEnrollmentOptions('budi', 1);

    expect(result.error).toBe('forbidden');
    if (result.error !== 'forbidden' || result.data !== null) {
      throw new Error('Expected a forbidden state without data');
    }
    // The picker treats this as the Creator/Teacher branch signal.
    expect(result.message).toMatch(/enrollment:read/);
  });

  it('answers api on a backend outage and limit on a refused page', async () => {
    installFetch(() => failure(500));
    expect((await searchDirectEnrollmentOptions('budi', 1)).error).toBe('api');

    installFetch(() => failure(400, 'page out of range'));
    expect((await searchDirectEnrollmentOptions('budi', 999)).error).toBe('limit');
  });

  it('dedupes repeated enrollments on the page', async () => {
    const entry = {
      id: ENROLLMENT_ID,
      student: { first_name: 'Budi', last_name: 'Santoso' },
      class: { id: 'class-1', name: 'Matematika Dasar' },
    };
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments?`)) {
        return success({
          items: [entry, entry, { title: 'Tanpa id' }],
          pagination: pagination({ total_items: 3 }),
        });
      }
      return undefined;
    });

    const result = await searchDirectEnrollmentOptions('budi', 1);

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.items).toHaveLength(1);
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;

    const result = await searchDirectEnrollmentOptions('budi', 1);

    expect(result.error).toBe('configuration');
  });
});

describe('searchTaughtEnrollmentOptions', () => {
  const sessionId = 'd1f1c0a9-4a7e-4c1d-9c4e-6f2b0d8a5e22';

  function taughtRoute(attendees: Record<string, unknown[]>) {
    return (url: string) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return success({
          items: [{ id: sessionId, class: { id: 'class-1', name: 'Matematika Dasar' } }],
          pagination: pagination({ total_items: 1 }),
        });
      }
      const match = url.match(/\/api\/v1\/sessions\/(.+)\/attendees$/);
      if (match) {
        const list = attendees[match[1] as string];
        if (list === undefined) return undefined;
        return success(list);
      }
      return undefined;
    };
  }

  it('resolves the session page students through attendees', async () => {
    installFetch(
      taughtRoute({
        [sessionId]: [
          { id: ENROLLMENT_ID, student: { first_name: 'Budi', last_name: 'Santoso' } },
        ],
      })
    );

    const result = await searchTaughtEnrollmentOptions('matematika', 1);

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.items).toEqual([
      {
        enrollment_id: ENROLLMENT_ID,
        label: 'Budi Santoso · Matematika Dasar',
        class_id: 'class-1',
        class_name: 'Matematika Dasar',
      },
    ]);
    expect(result.data.classes).toEqual([{ class_id: 'class-1', name: 'Matematika Dasar' }]);
    expect(result.data.partialFailures).toBe(0);

    const sessionPaths = requestedPaths().filter((path) =>
      path.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)
    );
    expect(sessionPaths).toHaveLength(1);

    const url = new URL(sessionPaths[0] as string);
    expect(url.searchParams.get('mine')).toBe('true');
    expect(url.searchParams.get('search')).toBe('matematika');
    expect(url.searchParams.get('page_size')).toBe('100');
    expect(requestedPaths()).toContain(`${GATEWAY_URL}/api/v1/sessions/${sessionId}/attendees`);
  });

  it('counts a failed attendee read instead of hiding the page', async () => {
    const otherSession = 'e2f2d1b0-5b8f-4d2e-ad5f-7f3c1e9b6f33';
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return success({
          items: [
            { id: sessionId, class: { id: 'class-1', name: 'Matematika Dasar' } },
            { id: otherSession, class: { id: 'class-2', name: 'Kelas Dua' } },
          ],
          pagination: pagination({ total_items: 2 }),
        });
      }
      if (url === `${GATEWAY_URL}/api/v1/sessions/${sessionId}/attendees`) {
        return success([
          { id: ENROLLMENT_ID, student: { first_name: 'Budi', last_name: 'Santoso' } },
        ]);
      }
      if (url === `${GATEWAY_URL}/api/v1/sessions/${otherSession}/attendees`) {
        return failure(500, 'attendee read down');
      }
      return undefined;
    });

    const result = await searchTaughtEnrollmentOptions('', 1);

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.items).toHaveLength(1);
    expect(result.data.partialFailures).toBe(1);
  });

  it('reads an explicit later session page past the first 1000 sessions', async () => {
    const lateSession = 'f3f3e2c1-6c9d-4e5f-bd6e-8d4e2f0a7b44';
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        const params = new URL(url).searchParams;
        expect(params.get('mine')).toBe('true');
        expect(params.get('page')).toBe('11');
        return success({
          items: [{ id: lateSession, class: { id: 'class-9', name: 'Kelas Akhir' } }],
          pagination: { page: 11, page_size: 100, total_items: 1101, total_pages: 12 },
        });
      }
      if (url === `${GATEWAY_URL}/api/v1/sessions/${lateSession}/attendees`) {
        return success([
          { id: ENROLLMENT_ID, student: { first_name: 'Siswa', last_name: 'Seribu' } },
        ]);
      }
      return undefined;
    });

    const result = await searchTaughtEnrollmentOptions('', 11);

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.items).toEqual([
      {
        enrollment_id: ENROLLMENT_ID,
        label: 'Siswa Seribu · Kelas Akhir',
        class_id: 'class-9',
        class_name: 'Kelas Akhir',
      },
    ]);
    expect(result.data.pagination.page).toBe(11);
    expect(result.data.pagination.total_pages).toBe(12);
  });

  it('answers forbidden when the caller lacks schedule:read', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return failure(403, 'schedule:read required');
      }
      return undefined;
    });

    const result = await searchTaughtEnrollmentOptions('', 1);

    expect(result.error).toBe('forbidden');
    if (result.error !== 'forbidden' || result.data !== null) {
      throw new Error('Expected a forbidden state without data');
    }
    expect(result.message).toMatch(/schedule:read/);
  });

  it('answers limit without a request past the backend page bound', async () => {
    installFetch(() => {
      throw new Error('Must not request past the page bound');
    });

    const result = await searchTaughtEnrollmentOptions('', 1001);

    expect(result.error).toBe('limit');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a missing gateway configuration instead of throwing', async () => {
    delete process.env.GATEWAY_API_URL;

    const result = await searchTaughtEnrollmentOptions('', 1);

    expect(result.error).toBe('configuration');
  });
});
