'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import {
  normalizeApprovePayment,
  scheduleRequestDecisionErrorMessage,
} from '@/lib/schedule-request';
import { TENANT_SCHEDULE_REQUESTS_PATH } from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REJECT_REASON_MAX_LENGTH = 2000;

/**
 * Outcome of a tenant approve/reject decision (KEL-110).
 *
 * `paymentUrl` is present only on a successful approval whose billing answer
 * carried a usable http(s) checkout link. `grossAmount` rides along for the
 * confirmation copy and is null when billing omitted it.
 */
export type ScheduleRequestDecisionState = {
  success: boolean;
  message: string;
  paymentUrl?: string;
  grossAmount?: number | null;
};

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
async function readDecisionEnvelope(
  response: Response
): Promise<{ status?: string; message?: string; code?: string; data?: unknown } | null> {
  try {
    return (await response.json()) as {
      status?: string;
      message?: string;
      code?: string;
      data?: unknown;
    };
  } catch {
    return null;
  }
}

/**
 * Approves one pending private schedule request of the caller's tenant
 * (KEL-110).
 *
 * The backend owns the transition through the tenant claim: the browser
 * supplies only the request id. On success the page is revalidated so the
 * row re-renders as approved, and the billing checkout link is returned for
 * the dialog to display with its copy button. Billing carries no expiry
 * field on this answer, so no deadline is shown — only the link itself.
 */
export async function approveScheduleRequest(
  _previous: ScheduleRequestDecisionState,
  formData: FormData
): Promise<ScheduleRequestDecisionState> {
  const requestId = String(formData.get('request_id') ?? '').trim();
  if (!UUID_PATTERN.test(requestId)) {
    return { success: false, message: 'ID permintaan jadwal tidak valid.' };
  }

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${getGatewayBaseUrl()}/api/v1/schedule-requests/${encodeURIComponent(requestId)}/approve`,
      { method: 'POST', headers, cache: 'no-store' }
    );
    const result = await readDecisionEnvelope(response);

    if (!response.ok || result?.status !== 'success') {
      return {
        success: false,
        message: scheduleRequestDecisionErrorMessage(response.status, result?.message, result?.code),
      };
    }

    const payment = normalizeApprovePayment(result?.data);
    revalidatePath(TENANT_SCHEDULE_REQUESTS_PATH);
    if (!payment) {
      return {
        success: true,
        message: 'Permintaan jadwal disetujui. Tautan pembayaran belum tersedia dari layanan billing.',
      };
    }
    return {
      success: true,
      message: 'Permintaan jadwal disetujui. Salin tautan pembayaran untuk dibagikan ke parent.',
      paymentUrl: payment.url,
      grossAmount: payment.grossAmount,
    };
  } catch (error) {
    return {
      success: false,
      message: getGatewayConfigurationErrorMessage(error) || 'Persetujuan belum dapat diproses. Coba lagi nanti.',
    };
  }
}

/**
 * Rejects one pending private schedule request of the caller's tenant
 * (KEL-110).
 *
 * The reason is optional and capped at 2000 characters, matching the backend
 * validation; a blank reason is omitted from the body rather than sent as an
 * empty string. On success the page is revalidated so the row re-renders as
 * rejected.
 */
export async function rejectScheduleRequest(
  _previous: ScheduleRequestDecisionState,
  formData: FormData
): Promise<ScheduleRequestDecisionState> {
  const requestId = String(formData.get('request_id') ?? '').trim();
  if (!UUID_PATTERN.test(requestId)) {
    return { success: false, message: 'ID permintaan jadwal tidak valid.' };
  }

  const reason = String(formData.get('reason') ?? '').trim();
  if (reason.length > REJECT_REASON_MAX_LENGTH) {
    return { success: false, message: 'Alasan penolakan maksimal 2000 karakter.' };
  }

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${getGatewayBaseUrl()}/api/v1/schedule-requests/${encodeURIComponent(requestId)}/reject`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(reason ? { reason } : {}),
        cache: 'no-store',
      }
    );
    const result = await readDecisionEnvelope(response);

    if (!response.ok || result?.status !== 'success') {
      return {
        success: false,
        message: scheduleRequestDecisionErrorMessage(response.status, result?.message, result?.code),
      };
    }

    revalidatePath(TENANT_SCHEDULE_REQUESTS_PATH);
    return { success: true, message: 'Permintaan jadwal berhasil ditolak.' };
  } catch (error) {
    return {
      success: false,
      message: getGatewayConfigurationErrorMessage(error) || 'Penolakan belum dapat diproses. Coba lagi nanti.',
    };
  }
}
