import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration test for the KEL-153 transaction refund Server Action.
 *
 * The action cannot reach its real collaborators here: `next/headers` needs a
 * request scope, `next/cache` needs a render scope, and the request goes out
 * over `fetch`. All three are replaced, and what is asserted is the observable
 * contract the acceptance criteria depend on:
 *
 * - the exact method, path, and JSON body the gateway receives, including that
 *   the body carries exactly `{ reason, transfer_reference }` and no tenant or
 *   status the browser must not supply,
 * - that a blank reason or transfer reference never reaches the network,
 * - that an invalid transaction id never reaches the network,
 * - that `409` (already refunded by another member) and `503` (enrollment
 *   termination failure) are reported as refusals the member can act on,
 * - that a successful refund revalidates the transaction list so the row is
 *   re-rendered from the backend as `refunded`,
 * - that no message ever carries the raw server error text.
 *
 * `next/headers`, `next/cache`, and the gateway helper are mocked through
 * `vi.mock` rather than by stubbing globals because the action imports them by
 * module path.
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

const { recordTransactionRefund } = await import('./refundActions');
const {
  EMPTY_TRANSACTION_REFUND_STATE,
  EMPTY_REFUND_REASON_MESSAGE,
  EMPTY_REFUND_REFERENCE_MESSAGE,
} = await import('@/lib/transaction-refund');
const { TENANT_TRANSACTIONS_PATH } = await import('../_lib/transactions');

const GATEWAY_URL = 'http://gateway.test';
const TRANSACTION_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const REFUND_PATH = `${GATEWAY_URL}/api/v1/billing/transactions/${TRANSACTION_ID}/refund`;
const REASON = 'Kelas dibatalkan atas permintaan parent';
const TRANSFER_REFERENCE = 'TRF-2026-09-27-001';

function success(data: unknown = { transaction_id: TRANSACTION_ID, status: 'refunded' }) {
  return new Response(JSON.stringify({ status: 'success', message: 'Refund recorded', data }), {
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

let fetchMock: ReturnType<typeof vi.fn>;
let savedGatewayUrl: string | undefined;

function installFetch(response: Response) {
  fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
}

function formDataOf(fields: { transaction_id: string; reason: string; transfer_reference: string }): FormData {
  const formData = new FormData();
  formData.set('transaction_id', fields.transaction_id);
  formData.set('reason', fields.reason);
  formData.set('transfer_reference', fields.transfer_reference);
  return formData;
}

function validForm(): FormData {
  return formDataOf({ transaction_id: TRANSACTION_ID, reason: REASON, transfer_reference: TRANSFER_REFERENCE });
}

function lastRequest(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  return { url: String(call?.[0]), init: (call?.[1] ?? {}) as RequestInit };
}

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

describe('recordTransactionRefund', () => {
  it('posts exactly reason and transfer_reference to the billing refund route', async () => {
    installFetch(success());

    const state = await recordTransactionRefund(EMPTY_TRANSACTION_REFUND_STATE, validForm());

    expect(state.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = lastRequest();
    expect(url).toBe(REFUND_PATH);
    expect(init.method).toBe('POST');
    // The gateway receives exactly the evidence fields — snake_case as the
    // billing handler binds — and no tenant or status from the browser.
    expect(JSON.parse(String(init.body))).toEqual({ reason: REASON, transfer_reference: TRANSFER_REFERENCE });
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer session-token',
      'X-Tenant-ID': 'tenant-1',
    });
  });

  it('revalidates the transaction list on success so the row renders refunded', async () => {
    installFetch(success());

    await recordTransactionRefund(EMPTY_TRANSACTION_REFUND_STATE, validForm());

    expect(revalidatePath).toHaveBeenCalledWith(TENANT_TRANSACTIONS_PATH);
  });

  it('never sends a form without a reason or a transfer reference', async () => {
    installFetch(success());

    const withoutReason = await recordTransactionRefund(
      EMPTY_TRANSACTION_REFUND_STATE,
      formDataOf({ transaction_id: TRANSACTION_ID, reason: '  ', transfer_reference: TRANSFER_REFERENCE })
    );
    const withoutReference = await recordTransactionRefund(
      EMPTY_TRANSACTION_REFUND_STATE,
      formDataOf({ transaction_id: TRANSACTION_ID, reason: REASON, transfer_reference: '' })
    );

    expect(withoutReason).toMatchObject({ status: 'error', message: EMPTY_REFUND_REASON_MESSAGE });
    expect(withoutReference).toMatchObject({ status: 'error', message: EMPTY_REFUND_REFERENCE_MESSAGE });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects an invalid transaction id before any request', async () => {
    installFetch(success());

    const state = await recordTransactionRefund(
      EMPTY_TRANSACTION_REFUND_STATE,
      formDataOf({ transaction_id: 'tx-1', reason: REASON, transfer_reference: TRANSFER_REFERENCE })
    );

    expect(state.status).toBe('error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an already-refunded transaction as a conflict with a reload next step', async () => {
    installFetch(failure(409, 'Only paid transactions can be refunded'));

    const state = await recordTransactionRefund(EMPTY_TRANSACTION_REFUND_STATE, validForm());

    expect(state.status).toBe('error');
    expect(state.message).toContain('Muat ulang');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reports an enrollment-termination failure without closing over the backend text', async () => {
    installFetch(failure(503, 'enrollment termination unavailable'));

    const state = await recordTransactionRefund(EMPTY_TRANSACTION_REFUND_STATE, validForm());

    expect(state.status).toBe('error');
    expect(state.message).toContain('tidak tersedia');
    expect(state.message).not.toContain('enrollment termination unavailable');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reports a missing transaction and never passes raw server errors through', async () => {
    installFetch(failure(404, 'Transaction not found'));

    const missing = await recordTransactionRefund(EMPTY_TRANSACTION_REFUND_STATE, validForm());
    expect(missing.status).toBe('error');
    expect(missing.message).toContain('tidak ditemukan');

    installFetch(failure(500, 'pq: duplicate key value'));

    const broken = await recordTransactionRefund(EMPTY_TRANSACTION_REFUND_STATE, validForm());
    expect(broken.status).toBe('error');
    expect(broken.message).not.toContain('pq:');
  });

  it('reports a member without billing:refund as forbidden', async () => {
    installFetch(failure(403, 'Permission denied'));

    const state = await recordTransactionRefund(EMPTY_TRANSACTION_REFUND_STATE, validForm());

    expect(state.status).toBe('error');
    expect(state.message).toContain('billing:refund');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
