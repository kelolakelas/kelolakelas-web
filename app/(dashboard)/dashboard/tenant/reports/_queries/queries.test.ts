import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListPagination } from '@/lib/list-envelope';

/**
 * Integration test for the tenant report overview reader (KEL-139).
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
 * the list, a refused enrollment list falls back to the Teacher-authorized
 * taught-session lookup (so the first report can be created with no rows on
 * the page), and failed auxiliary lookups degrade to the enrollments already
 * visible on the page — or to an explicit empty option — instead of taking
 * the page down.
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

const { getTenantReports } = await import('./queries');

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

function reportsRoute(reports: unknown[], enrollments: unknown[] | null = []) {
  return (url: string) => {
    if (url.startsWith(`${GATEWAY_URL}/api/v1/reports?`)) {
      return success({ items: reports, pagination: pagination({ total_items: reports.length }) });
    }
    if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments?`)) {
      if (enrollments === null) {
        return failure(500);
      }
      return success({ items: enrollments, pagination: pagination({ total_items: enrollments.length }) });
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
    installFetch(reportsRoute([reportRow()]));

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.rows).toHaveLength(1);
    expect(result.data.rows[0]?.report.title).toBe('Evaluasi tengah semester');
    expect(result.data.rows[0]?.report.enrollment?.student?.first_name).toBe('Budi');

    const paths = requestedPaths();
    expect(paths).toHaveLength(2);

    const reportsUrl = new URL(paths[0] as string);
    expect(reportsUrl.searchParams.get('page')).toBe('1');
    expect(reportsUrl.searchParams.get('page_size')).toBe('20');
    expect(reportsUrl.searchParams.has('class_id')).toBe(false);

    const enrollmentsUrl = new URL(paths[1] as string);
    expect(enrollmentsUrl.searchParams.get('status')).toBe('active');

    expect(headersOf(paths[0] as string)).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
  });

  it('forwards the search, enrollment, and date filters', async () => {
    installFetch(reportsRoute([]));

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
    installFetch(reportsRoute([reportRow()]));

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
    installFetch(reportsRoute([{ title: 'Tanpa id' }, reportRow()]));

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.rows).toHaveLength(1);
    expect(result.data.rows[0]?.report.id).toBe(REPORT_ID);
  });

  it('degrades failed auxiliary lookups to the enrollments on the page', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/reports?`)) {
        return success({ items: [reportRow()], pagination: pagination({ total_items: 1 }) });
      }
      return failure(403, 'no auxiliary access');
    });

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.rows).toHaveLength(1);
    expect(result.data.enrollments).toEqual([
      { enrollment_id: ENROLLMENT_ID, label: 'Budi Santoso · Matematika Dasar' },
    ]);
  });

  it('uses taught sessions when a Teacher cannot read enrollments and has no reports yet', async () => {
    const sessionId = 'd1f1c0a9-4a7e-4c1d-9c4e-6f2b0d8a5e22';
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/reports?`)) {
        return success({ items: [], pagination: pagination({ total_items: 0, total_pages: 0 }) });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments?`)) {
        return failure(403, 'enrollment:read required');
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return success({
          items: [{ id: sessionId, class: { id: 'class-1', name: 'Matematika Dasar' } }],
          pagination: pagination({ total_items: 1 }),
        });
      }
      if (url === `${GATEWAY_URL}/api/v1/sessions/${sessionId}/attendees`) {
        return success([
          {
            id: ENROLLMENT_ID,
            student: { first_name: 'Budi', last_name: 'Santoso' },
          },
        ]);
      }
      return undefined;
    });

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.rows).toHaveLength(0);
    expect(result.data.enrollments).toEqual([
      { enrollment_id: ENROLLMENT_ID, label: 'Budi Santoso · Matematika Dasar' },
    ]);
    expect(requestedPaths()).toContain(`${GATEWAY_URL}/api/v1/sessions/${sessionId}/attendees`);
  });

  it('walks every taught session page so a class past page 1 can file its first report', async () => {
    const sessionPage1 = 'd1f1c0a9-4a7e-4c1d-9c4e-6f2b0d8a5e22';
    const sessionPage2 = 'e2f2d1b0-5b8f-4d2e-ad5f-7f3c1e9b6f33';
    const otherEnrollment = 'a0aa0000-1111-4222-8333-444455556666';
    const targetEnrollment = 'b0bb0000-1111-4222-8333-444455556666';
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/reports?`)) {
        return success({ items: [], pagination: pagination({ total_items: 0, total_pages: 0 }) });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments?`)) {
        return failure(403, 'enrollment:read required');
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        const page = new URL(url).searchParams.get('page');
        if (page === '2') {
          return success({
            items: [{ id: sessionPage2, class: { id: 'class-b', name: 'Kelas B' } }],
            pagination: pagination({ page: 2, total_items: 2, total_pages: 2 }),
          });
        }
        return success({
          items: [{ id: sessionPage1, class: { id: 'class-a', name: 'Kelas A' } }],
          pagination: pagination({ total_items: 2, total_pages: 2 }),
        });
      }
      if (url === `${GATEWAY_URL}/api/v1/sessions/${sessionPage1}/attendees`) {
        return success([
          { id: otherEnrollment, student: { first_name: 'Andi', last_name: 'Awal' } },
        ]);
      }
      if (url === `${GATEWAY_URL}/api/v1/sessions/${sessionPage2}/attendees`) {
        return success([
          { id: targetEnrollment, student: { first_name: 'Budi', last_name: 'Kedua' } },
        ]);
      }
      return undefined;
    });

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.rows).toHaveLength(0);
    expect(result.data.enrollments).toContainEqual({
      enrollment_id: targetEnrollment,
      label: 'Budi Kedua · Kelas B',
    });

    const sessionRequests = requestedPaths().filter((path) =>
      path.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)
    );
    expect(sessionRequests).toHaveLength(2);
    for (const path of sessionRequests) {
      expect(new URL(path).searchParams.get('mine')).toBe('true');
    }
    expect(new URL(sessionRequests[0] as string).searchParams.get('page')).toBe('1');
    expect(new URL(sessionRequests[1] as string).searchParams.get('page')).toBe('2');
  });

  it('walks every enrollment page so a Creator sees students past page 1', async () => {
    const otherEnrollment = {
      id: 'a0aa0000-1111-4222-8333-444455556666',
      student: { first_name: 'Andi', last_name: 'Awal' },
      class: { id: 'class-a', name: 'Kelas A' },
    };
    const targetEnrollment = 'b0bb0000-1111-4222-8333-444455556666';
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/reports?`)) {
        return success({ items: [], pagination: pagination({ total_items: 0, total_pages: 0 }) });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments?`)) {
        const page = new URL(url).searchParams.get('page');
        if (page === '2') {
          return success({
            items: [
              {
                id: targetEnrollment,
                student: { first_name: 'Citra', last_name: 'Target' },
                class: { id: 'class-b', name: 'Kelas B' },
              },
            ],
            pagination: pagination({ page: 2, total_items: 2, total_pages: 2 }),
          });
        }
        return success({
          items: [otherEnrollment],
          pagination: pagination({ total_items: 2, total_pages: 2 }),
        });
      }
      return undefined;
    });

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.enrollments).toContainEqual({
      enrollment_id: targetEnrollment,
      label: 'Citra Target · Kelas B',
    });
    const enrollmentRequests = requestedPaths().filter((path) =>
      path.startsWith(`${GATEWAY_URL}/api/v1/enrollments?`)
    );
    expect(enrollmentRequests).toHaveLength(2);
    expect(
      requestedPaths().some((path) => path.startsWith(`${GATEWAY_URL}/api/v1/sessions?`))
    ).toBe(false);
  });

  it('keeps the reports when a later auxiliary page fails', async () => {
    const sessionId = 'd1f1c0a9-4a7e-4c1d-9c4e-6f2b0d8a5e22';
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/reports?`)) {
        return success({ items: [reportRow()], pagination: pagination({ total_items: 1 }) });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments?`)) {
        return failure(403, 'enrollment:read required');
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        const page = new URL(url).searchParams.get('page');
        if (page === '2') {
          return failure(500, 'later page down');
        }
        return success({
          items: [{ id: sessionId, class: { id: 'class-1', name: 'Matematika Dasar' } }],
          pagination: pagination({ total_items: 2, total_pages: 2 }),
        });
      }
      if (url === `${GATEWAY_URL}/api/v1/sessions/${sessionId}/attendees`) {
        return success([
          { id: ENROLLMENT_ID, student: { first_name: 'Budi', last_name: 'Santoso' } },
        ]);
      }
      return undefined;
    });

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.rows).toHaveLength(1);
    expect(result.data.enrollments).toEqual([
      { enrollment_id: ENROLLMENT_ID, label: 'Budi Santoso · Matematika Dasar' },
    ]);
  });

  it('treats malformed pagination as one page and dedupes repeated enrollments', async () => {
    const sessionOne = 'd1f1c0a9-4a7e-4c1d-9c4e-6f2b0d8a5e22';
    const sessionTwo = 'e2f2d1b0-5b8f-4d2e-ad5f-7f3c1e9b6f33';
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/reports?`)) {
        return success({ items: [], pagination: pagination({ total_items: 0, total_pages: 0 }) });
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/enrollments?`)) {
        return failure(403, 'enrollment:read required');
      }
      if (url.startsWith(`${GATEWAY_URL}/api/v1/sessions?`)) {
        return success({
          items: [
            { id: sessionOne, class: { id: 'class-1', name: 'Matematika Dasar' } },
            { id: sessionTwo, class: { id: 'class-1', name: 'Matematika Dasar' } },
          ],
          pagination: { page: 1, page_size: 100, total_items: 2, total_pages: 'banyak' },
        });
      }
      if (
        url === `${GATEWAY_URL}/api/v1/sessions/${sessionOne}/attendees` ||
        url === `${GATEWAY_URL}/api/v1/sessions/${sessionTwo}/attendees`
      ) {
        return success([
          { id: ENROLLMENT_ID, student: { first_name: 'Budi', last_name: 'Santoso' } },
          { title: 'Tanpa id' },
        ]);
      }
      return undefined;
    });

    const result = await getTenantReports({});

    expect(result.error).toBeNull();
    if (result.error !== null || result.data === null) return;

    expect(result.data.enrollments).toEqual([
      { enrollment_id: ENROLLMENT_ID, label: 'Budi Santoso · Matematika Dasar' },
    ]);
    expect(
      requestedPaths().filter((path) => path.startsWith(`${GATEWAY_URL}/api/v1/sessions?`))
    ).toHaveLength(1);
  });

  it('keeps an empty create option safe when every auxiliary lookup fails', async () => {
    installFetch((url) => {
      if (url.startsWith(`${GATEWAY_URL}/api/v1/reports?`)) {
        return success({ items: [], pagination: pagination({ total_items: 0, total_pages: 0 }) });
      }
      return failure(503);
    });

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
