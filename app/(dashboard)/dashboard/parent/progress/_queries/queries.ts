import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { normalizeListEnvelope } from '@/lib/list-envelope';
import { upcomingWindow, type ProgressAttendance, type ProgressReport, type ProgressSession } from '../_lib/progress';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

export type ProgressQueryError = 'forbidden' | 'api' | 'configuration';

export type ProgressQueryResult<T> =
  | { data: T; error: null }
  | { data: null; error: ProgressQueryError; message: string };

export interface ProgressListData {
  items: ProgressSession[] | ProgressAttendance[] | ProgressReport[];
}

const FORBIDDEN_MESSAGE =
  'Anda tidak memiliki akses ke data progres anak ini. Masuk kembali dengan akun parent yang terdaftar.';
const API_MESSAGE = 'Data progres belum dapat dimuat. Coba muat ulang beberapa saat lagi.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidListData(data: unknown): boolean {
  if (Array.isArray(data)) return true;
  return isRecord(data) && Array.isArray(data.items);
}

async function readList(
  path: string,
  token: string,
): Promise<{ status: number; ok: boolean; body: Record<string, unknown> }> {
  const response = await fetch(`${getGatewayBaseUrl()}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const raw: unknown = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, body: isRecord(raw) ? raw : {} };
}

/**
 * Parent-scoped progress lists (KEL-141).
 *
 * The backend (KEL-140) scopes every list to the parent's own children, so
 * `student_id` only narrows the parent's own rows and a foreign id yields an
 * empty list, never another parent's rows. A payload without an `items`
 * array is malformed and reported as an `api` error — never as a valid
 * empty list.
 */
async function readProgressList<T>(path: string, emptyMessage: string): Promise<ProgressQueryResult<T[]>> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value || '';
    const { status, ok, body } = await readList(path, token);
    if (status === 401 || status === 403) {
      return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    }
    if (!ok || body.status !== 'success' || !isValidListData(body.data)) {
      return { data: null, error: 'api', message: emptyMessage || API_MESSAGE };
    }
    return { data: normalizeListEnvelope<T>(body.data).items, error: null };
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message: getGatewayConfigurationErrorMessage(error) || 'Layanan progres sedang tidak tersedia. Coba lagi nanti.',
    };
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function studentParam(studentId: string): string {
  return UUID_PATTERN.test(studentId) ? `&student_id=${encodeURIComponent(studentId)}` : '';
}

/** Upcoming sessions of one child: today through 13 days later. */
export async function getUpcomingSessions(
  studentId: string,
  today?: string,
): Promise<ProgressQueryResult<ProgressSession[]>> {
  const { dateFrom, dateTo } = upcomingWindow(today);
  return readProgressList<ProgressSession>(
    `/api/v1/sessions?date_from=${dateFrom}&date_to=${dateTo}&page=1&page_size=100${studentParam(studentId)}`,
    'Jadwal sesi mendatang belum dapat dimuat.',
  );
}

/** Attendance history of one child, newest first. */
export async function getStudentAttendance(
  studentId: string,
): Promise<ProgressQueryResult<ProgressAttendance[]>> {
  return readProgressList<ProgressAttendance>(
    `/api/v1/attendance?page=1&page_size=100${studentParam(studentId)}`,
    'Riwayat kehadiran belum dapat dimuat.',
  );
}

/** Report list of one child, newest first. */
export async function getStudentReports(
  studentId: string,
): Promise<ProgressQueryResult<ProgressReport[]>> {
  return readProgressList<ProgressReport>(
    `/api/v1/reports?page=1&page_size=100${studentParam(studentId)}`,
    'Daftar laporan belum dapat dimuat.',
  );
}

export type ProgressReportDetailResult =
  | { data: ProgressReport; error: null }
  | { data: null; error: 'not_found' | ProgressQueryError; message: string };

/**
 * One report of the parent's own child. Another parent's id answers 404
 * upstream, reported here as `not_found` so ids do not leak.
 */
export async function getStudentReportDetail(
  reportId: string,
): Promise<ProgressReportDetailResult> {
  try {
    if (!UUID_PATTERN.test(reportId)) {
      return { data: null, error: 'not_found', message: 'Laporan tidak ditemukan pada akun Anda.' };
    }
    const token = (await cookies()).get(AUTH_COOKIE)?.value || '';
    const { status, ok, body } = await readList(
      `/api/v1/reports/${encodeURIComponent(reportId)}`,
      token,
    );
    if (status === 401 || status === 403) {
      return { data: null, error: 'forbidden', message: FORBIDDEN_MESSAGE };
    }
    if (status === 404) {
      return { data: null, error: 'not_found', message: 'Laporan tidak ditemukan pada akun Anda.' };
    }
    const record = body.data;
    if (!ok || body.status !== 'success' || !isRecord(record) || typeof record.id !== 'string') {
      return { data: null, error: 'api', message: 'Detail laporan belum dapat dimuat.' };
    }
    return { data: record as unknown as ProgressReport, error: null };
  } catch (error) {
    return {
      data: null,
      error: 'configuration',
      message: getGatewayConfigurationErrorMessage(error) || 'Layanan progres sedang tidak tersedia. Coba lagi nanti.',
    };
  }
}
