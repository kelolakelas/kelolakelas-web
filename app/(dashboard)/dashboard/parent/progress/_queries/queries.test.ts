import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contract test for the parent progress queries (KEL-141) against a stubbed
 * gateway. It pins: the two-week `date_from`/`date_to` window on sessions,
 * the `student_id` narrowing on attendance/reports, UUID validation on the
 * report detail, and the forbidden/api/configuration error mapping.
 */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'auth_token' ? { name, value: 'session-token' } : undefined),
  })),
}));

const { getUpcomingSessions, getStudentAttendance, getStudentReports, getStudentReportDetail } = await import(
  './queries'
);

const STUDENT = '123e4567-e89b-12d3-a456-426614174001';
const REPORT = '223e4567-e89b-12d3-a456-426614174001';

function json(status: number, body: unknown): { status: number; body: unknown } {
  return { status, body };
}

function list(items: unknown[]) {
  return json(200, {
    status: 'success',
    data: { items, pagination: { page: 1, page_size: 100, total_items: items.length, total_pages: 1 } },
  });
}

function stubGateway(handler: (url: string) => { status: number; body: unknown }) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      calls.push(input);
      const route = handler(input);
      return new Response(JSON.stringify(route.body), {
        status: route.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
  return calls;
}

beforeEach(() => {
  vi.stubEnv('GATEWAY_API_URL', 'http://gateway.test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getUpcomingSessions', () => {
  it('sends the two-week window with the student filter', async () => {
    const calls = stubGateway(() => list([{ id: 's1' }]));

    const result = await getUpcomingSessions(STUDENT, '2026-10-02');

    expect(result.error).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('/api/v1/sessions?');
    expect(calls[0]).toContain('date_from=2026-10-02');
    expect(calls[0]).toContain('date_to=2026-10-15');
    expect(calls[0]).toContain(`student_id=${STUDENT}`);
  });

  it('maps 403 to forbidden', async () => {
    stubGateway(() => json(403, { status: 'error', message: 'nope', data: null }));

    const result = await getUpcomingSessions(STUDENT, '2026-10-02');

    expect(result).toMatchObject({ data: null, error: 'forbidden' });
  });

  it('reports a payload without items as an api error, never an empty list', async () => {
    stubGateway(() => json(200, { status: 'success', data: { pagination: {} } }));

    const result = await getUpcomingSessions(STUDENT, '2026-10-02');

    expect(result).toMatchObject({ data: null, error: 'api' });
  });
});

describe('getStudentAttendance / getStudentReports', () => {
  it('narrows both lists with student_id', async () => {
    const calls = stubGateway((url) =>
      url.includes('/api/v1/attendance') ? list([{ id: 'a1' }]) : list([{ id: 'r1' }]),
    );

    const attendance = await getStudentAttendance(STUDENT);
    const reports = await getStudentReports(STUDENT);

    expect(attendance.error).toBeNull();
    expect(reports.error).toBeNull();
    expect(calls.some((url) => url.includes('/api/v1/attendance?') && url.includes(`student_id=${STUDENT}`))).toBe(
      true,
    );
    expect(calls.some((url) => url.includes('/api/v1/reports?') && url.includes(`student_id=${STUDENT}`))).toBe(
      true,
    );
  });

  it('omits student_id for a malformed id instead of sending it', async () => {
    const calls = stubGateway(() => list([]));

    await getStudentAttendance('not-a-uuid');

    expect(calls[0]).not.toContain('student_id=');
  });
});

describe('getStudentReportDetail', () => {
  it('reads one parent-scoped report', async () => {
    const calls = stubGateway(() =>
      json(200, { status: 'success', data: { id: REPORT, title: 'Laporan' } }),
    );

    const result = await getStudentReportDetail(REPORT);

    expect(result.error).toBeNull();
    expect(calls[0]).toContain(`/api/v1/reports/${REPORT}`);
  });

  it('reports a malformed id as not_found without calling the gateway', async () => {
    const calls = stubGateway(() => list([]));

    const result = await getStudentReportDetail('bukan-uuid');

    expect(result).toMatchObject({ data: null, error: 'not_found' });
    expect(calls).toHaveLength(0);
  });

  it('maps an unknown id (404) to not_found', async () => {
    stubGateway(() => json(404, { status: 'error', message: 'Report not found', data: null }));

    const result = await getStudentReportDetail(REPORT);

    expect(result).toMatchObject({ data: null, error: 'not_found' });
  });

  it('maps 403 to forbidden', async () => {
    stubGateway(() => json(403, { status: 'error', message: 'denied', data: null }));

    const result = await getStudentReportDetail(REPORT);

    expect(result).toMatchObject({ data: null, error: 'forbidden' });
  });
});
