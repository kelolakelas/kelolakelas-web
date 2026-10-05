'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import {
  EMPTY_REFUND_REASON_MESSAGE,
  EMPTY_REFUND_REFERENCE_MESSAGE,
  INVALID_TRANSACTION_ID_MESSAGE,
  TRANSACTION_REFUND_SUCCESS_MESSAGE,
  isRefundableTransactionId,
  transactionRefundErrorMessage,
  transactionRefundRequestPath,
  type TransactionRefundState,
} from '@/lib/transaction-refund';
import { TENANT_TRANSACTIONS_PATH } from '../_lib/transactions';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * Records a full manual refund for one paid transaction (KEL-153).
 *
 * The billing service owns the decision: it resolves the transaction through
 * the caller's tenant, requires both `reason` and `transfer_reference`, moves
 * a `paid` transaction to `refunded`, and terminates the enrollment
 * asynchronously. This action therefore forwards only the transaction id plus
 * the two evidence fields — the browser never supplies a tenant or a status —
 * and reports whatever the backend decided. A successful refund revalidates
 * the transaction list so the row shows the `refunded` state the backend
 * stored rather than an optimistic local guess.
 */
export async function recordTransactionRefund(
  _previous: TransactionRefundState,
  formData: FormData
): Promise<TransactionRefundState> {
  const transactionId = formData.get('transaction_id')?.toString().trim() || '';
  if (!isRefundableTransactionId(transactionId)) {
    return { status: 'error', message: INVALID_TRANSACTION_ID_MESSAGE };
  }

  const reason = formData.get('reason')?.toString().trim() || '';
  if (!reason) {
    return { status: 'error', message: EMPTY_REFUND_REASON_MESSAGE };
  }

  const transferReference = formData.get('transfer_reference')?.toString().trim() || '';
  if (!transferReference) {
    return { status: 'error', message: EMPTY_REFUND_REFERENCE_MESSAGE };
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE)?.value || '';
    const tenantId = cookieStore.get(TENANT_COOKIE)?.value || '';

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const response = await fetch(
      `${getGatewayBaseUrl()}${transactionRefundRequestPath(transactionId)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason, transfer_reference: transferReference }),
        cache: 'no-store',
      }
    );
    const result = (await response.json().catch(() => ({}))) as {
      status?: string;
      message?: string;
    };

    if (!response.ok || result.status !== 'success') {
      return {
        status: 'error',
        message: transactionRefundErrorMessage(response.status, result.message),
      };
    }

    revalidatePath(TENANT_TRANSACTIONS_PATH);
    return { status: 'success', message: TRANSACTION_REFUND_SUCCESS_MESSAGE };
  } catch (error) {
    return {
      status: 'error',
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'Layanan refund sedang tidak tersedia. Coba lagi nanti.',
    };
  }
}
