'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { callerMatchesScope } from '@/lib/creator-requests';
import { getGatewayBaseUrl } from '@/lib/gateway';

export type WithdrawalActionState = { status: number; message: string };
const validId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) && value !== '00000000-0000-0000-0000-000000000000';

export async function decideWithdrawal(_previous: WithdrawalActionState, form: FormData): Promise<WithdrawalActionState> {
  const token = (await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  if (!token) return { status: 401, message: 'Session expired. Sign in again. No decision was recorded.' };
  if (!callerMatchesScope(token, true)) return { status: 403, message: 'Platform access required.' };
  const id = form.get('id');
  const decision = form.get('decision');
  const detail = form.get(decision === 'paid' ? 'transfer_reference' : 'reason');
  if (!validId(id) || (decision !== 'paid' && decision !== 'reject') || typeof detail !== 'string' || !detail.trim() || detail.trim().length > (decision === 'paid' ? 255 : 2000)) {
    return { status: 400, message: decision === 'paid' ? 'Enter a valid withdrawal and transfer reference (maximum 255 characters).' : 'Enter a valid withdrawal and rejection reason (maximum 2000 characters).' };
  }
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/platform/withdrawals/${id}/${decision}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(decision === 'paid' ? { transfer_reference: detail.trim() } : { reason: detail.trim() }), cache: 'no-store',
    });
    if (response.ok) {
      revalidatePath('/platform/withdrawals');
      return { status: 200, message: decision === 'paid' ? 'Payment recorded. Withdrawal removed from the pending queue.' : 'Withdrawal rejected and removed from the pending queue.' };
    }
    if (response.status === 409) {
      // Both a competing admin decision and a reused transfer reference return 409.
      let duplicateReference = false;
      try {
        const body: unknown = await response.json();
        duplicateReference = !!body && typeof body === 'object' && 'message' in body && body.message === 'Transfer reference already used';
      } catch { /* Treat an unreadable conflict as a concurrent decision. */ }
      return { status: 409, message: duplicateReference ? 'Transfer reference already used. Enter a different reference and check the queue.' : 'Withdrawal already processed or changed by another admin. Refresh the queue before deciding again.' };
    }
    return { status: response.status, message: response.status === 401 ? 'Session expired. Sign in again. No decision was recorded.' : response.status === 403 ? 'Access denied. Platform authorization may have been revoked.' : response.status === 400 ? 'Invalid decision details. Check the reference or reason.' : response.status === 404 ? 'Withdrawal not found. Refresh the queue.' : 'Decision failed. Try again.' };
  } catch {
    return { status: 503, message: 'Could not confirm the decision. Refresh the queue before retrying to avoid a duplicate payment record.' };
  }
}
