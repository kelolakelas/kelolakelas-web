'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { attendanceStatusSchema, isSessionUuid, TENANT_SESSIONS_PATH } from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * Outcome of one attendee row inside the mass attendance save (KEL-137).
 *
 * `saved` means the backend answered `201`. `already_saved` means it
 * answered `409`: the attendance already exists, so the row is recorded —
 * refreshing the page shows it — and it must not be reported as a failure.
 * `failed` covers every other refusal with a member-safe message; the raw
 * server text never reaches the screen.
 */
export type AttendanceRowOutcome = 'saved' | 'already_saved' | 'failed';

export interface AttendanceRowResult {
  enrollmentId: string;
  outcome: AttendanceRowOutcome;
  message: string | null;
}

/**
 * Outcome of the mass attendance save for one session.
 *
 * `saved` and `alreadySaved` count the rows a refresh will show; `failed`
 * counts the rows that need another attempt. `forbidden` is true only when
 * the member lacks `attendance:create`: the whole save was refused and no
 * row was written.
 */
export interface SaveSessionAttendanceState {
  success: boolean;
  message: string;
  results: AttendanceRowResult[];
  forbidden: boolean;
}

/**
 * Extracts authorization and tenant headers from server cookies.
 *
 * The tenant is resolved from the session server-side. A tenant identifier
 * sent by the browser is never treated as an authorization source: the API
 * gateway strips client-supplied context headers and the downstream services
 * derive the tenant from the JWT claim only.
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value || '';
  const tenantId = cookieStore.get(TENANT_COOKIE)?.value || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  return headers;
}

/**
 * Reads the backend JSON envelope without letting a non-JSON body (e.g. a
 * proxy error page) turn a mapped 403/404/409 into an unexpected error.
 */
async function readAttendanceEnvelope(
  response: Response
): Promise<{ status?: string; message?: string } | null> {
  try {
    return (await response.json()) as { status?: string; message?: string };
  } catch {
    return null;
  }
}

interface AttendanceDraft {
  enrollmentId: string;
  status: string;
}

/**
 * Reads the submitted rows from the `entries` form field (KEL-137).
 *
 * The dialog serialises one `{ enrollment_id, status }` entry per attendee
 * as JSON. Returns `null` when the payload cannot be parsed, is not an
 * array, or holds a row that fails the shared status schema — a tampered
 * body must not smuggle an invalid status to the backend. An empty array is
 * returned as-is so the caller can answer "nothing to save" instead of
 * sending a request the backend would reject.
 */
function parseAttendanceEntries(value: FormDataEntryValue | null): AttendanceDraft[] | null {
  if (value === null) {
    return null;
  }

  const raw = String(value).trim();

  if (raw === '') {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  const drafts: AttendanceDraft[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const candidate = item as { enrollment_id?: unknown; status?: unknown };

    if (!isSessionUuid(candidate.enrollment_id)) {
      return null;
    }

    const status = attendanceStatusSchema.safeParse(candidate.status);

    if (!status.success) {
      return null;
    }

    drafts.push({ enrollmentId: candidate.enrollment_id, status: status.data });
  }

  return drafts;
}

/** Member-safe message for one failed row, keyed by the backend answer. */
function rowFailureMessage(status: number): string {
  if (status === 404) {
    return 'Sesi tidak ditemukan. Muat ulang halaman lalu coba lagi.';
  }

  if (status === 400) {
    return 'Data kehadiran tidak valid untuk sesi ini.';
  }

  return 'Kehadiran belum dapat disimpan. Coba lagi nanti.';
}

async function saveAttendanceRow(
  headers: HeadersInit,
  sessionId: string,
  draft: AttendanceDraft
): Promise<AttendanceRowResult> {
  let response: Response;

  try {
    response = await fetch(`${getGatewayBaseUrl()}/api/v1/attendance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        enrollment_id: draft.enrollmentId,
        session_id: sessionId,
        status: draft.status,
      }),
      cache: 'no-store',
    });
  } catch {
    return { enrollmentId: draft.enrollmentId, outcome: 'failed', message: 'Kehadiran belum dapat disimpan. Coba lagi nanti.' };
  }

  if (response.status === 201 || response.status === 200) {
    return { enrollmentId: draft.enrollmentId, outcome: 'saved', message: null };
  }

  // The attendance already exists: re-saving the same session must read as
  // recorded, not as a failure, because the refresh shows the row.
  if (response.status === 409) {
    await readAttendanceEnvelope(response);
    return { enrollmentId: draft.enrollmentId, outcome: 'already_saved', message: 'Sudah tercatat sebelumnya.' };
  }

  await readAttendanceEnvelope(response);

  return { enrollmentId: draft.enrollmentId, outcome: 'failed', message: rowFailureMessage(response.status) };
}

/**
 * Saves the attendance of a whole session's attendees (KEL-137).
 *
 * The gateway proxies `POST /api/v1/attendance` but registers no
 * `/attendance/bulk` route, so every row is saved with its own request
 * addressed at `{ enrollment_id, session_id, status }` — the session_id
 * form is also the only one that addresses reschedule replacements
 * (KEL-134). Rows run together and each one reports its own outcome, which
 * is how the contract's "sebagian simpan gagal" edge case surfaces: the
 * saved rows stay saved and only the failed ones need another attempt. On
 * any saved row the page is revalidated so the refresh reads the recorded
 * states back from the backend rather than from an optimistic guess.
 */
export async function saveSessionAttendance(
  _previous: SaveSessionAttendanceState,
  formData: FormData
): Promise<SaveSessionAttendanceState> {
  const sessionId = String(formData.get('session_id') ?? '').trim();

  if (!isSessionUuid(sessionId)) {
    return { success: false, message: 'ID sesi tidak valid.', results: [], forbidden: false };
  }

  const drafts = parseAttendanceEntries(formData.get('entries'));

  if (drafts === null) {
    return { success: false, message: 'Data kehadiran tidak valid. Periksa setiap baris lalu coba lagi.', results: [], forbidden: false };
  }

  if (drafts.length === 0) {
    return { success: false, message: 'Belum ada siswa untuk dicatat kehadirannya.', results: [], forbidden: false };
  }

  if (drafts.length > 200) {
    return { success: false, message: 'Jumlah siswa melebihi batas 200 baris per penyimpanan.', results: [], forbidden: false };
  }

  let headers: HeadersInit;

  try {
    headers = await getAuthHeaders();
    void getGatewayBaseUrl();
  } catch (error) {
    return {
      success: false,
      message: getGatewayConfigurationErrorMessage(error) || 'Penyimpanan belum dapat diproses. Coba lagi nanti.',
      results: [],
      forbidden: false,
    };
  }

  const results = await Promise.all(
    drafts.map((draft) => saveAttendanceRow(headers, sessionId, draft))
  );

  const forbidden = await wasForbidden(headers, results);

  if (forbidden) {
    return {
      success: false,
      message: 'Anda tidak memiliki izin mencatat kehadiran. Hubungi administrator tenant untuk mendapatkan permission attendance:create.',
      results: results.map((result) =>
        result.outcome === 'failed'
          ? { ...result, message: 'Tidak memiliki izin attendance:create.' }
          : result
      ),
      forbidden: true,
    };
  }

  const saved = results.filter((result) => result.outcome === 'saved').length;
  const alreadySaved = results.filter((result) => result.outcome === 'already_saved').length;
  const failed = results.filter((result) => result.outcome === 'failed').length;

  if (saved > 0 || alreadySaved > 0) {
    revalidatePath(TENANT_SESSIONS_PATH);
  }

  if (failed === 0) {
    return {
      success: true,
      message:
        alreadySaved > 0 && saved === 0
          ? `Kehadiran sudah tercatat untuk ${alreadySaved} siswa.`
          : `Kehadiran tersimpan untuk ${saved + alreadySaved} siswa.`,
      results,
      forbidden: false,
    };
  }

  if (saved > 0 || alreadySaved > 0) {
    return {
      success: false,
      message: `Sebagian kehadiran tersimpan (${saved + alreadySaved} siswa), ${failed} siswa gagal. Coba lagi untuk baris yang gagal.`,
      results,
      forbidden: false,
    };
  }

  return {
    success: false,
    message: 'Kehadiran belum dapat disimpan. Coba lagi nanti.',
    results,
    forbidden: false,
  };
}

/**
 * Whether the failed rows were refused for lack of authorization.
 *
 * The per-row answers carry no permission signal of their own, so a save in
 * which every row failed is re-checked with a single read: a `401`/`403`
 * from the attendance list means the member lacks the attendance
 * permissions and the form must present the forbidden state instead of a
 * technical error. Any other answer keeps the per-row failure messages.
 */
async function wasForbidden(
  headers: HeadersInit,
  results: AttendanceRowResult[]
): Promise<boolean> {

  if (!results.every((result) => result.outcome === 'failed')) {
    return false;
  }

  try {
    const response = await fetch(
      `${getGatewayBaseUrl()}/api/v1/attendance?page=1&page_size=1`,
      { method: 'GET', headers, cache: 'no-store' }
    );

    return response.status === 401 || response.status === 403;
  } catch {
    return false;
  }
}
