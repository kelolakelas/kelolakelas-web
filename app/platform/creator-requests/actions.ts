'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from '@/lib/gateway';
import { callerMatchesScope } from '@/lib/creator-requests';
import type { CreatorActionState } from '@/app/(dashboard)/dashboard/tenant/creator-requests/actions';

export async function decideCreatorRequest(_previous: CreatorActionState, form: FormData): Promise<CreatorActionState> {
  const token = (await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  if (!token) return { status: 401, message: 'Session expired. Sign in again.' };
  if (!callerMatchesScope(token, true)) return { status: 403, message: 'Platform access required.' };
  const id = form.get('id');
  const decision = form.get('decision');
  const reason = form.get('reason');
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || (decision !== 'approve' && decision !== 'reject') || (decision === 'reject' && (typeof reason !== 'string' || !reason.trim() || reason.length > 2000))) {
    return { status: 400, message: 'Select a valid request and enter a rejection reason when rejecting.' };
  }
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/platform/creator-requests/${id}/${decision}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(decision === 'reject' ? { reason: (reason as string).trim() } : {}), cache: 'no-store',
    });
    if (response.ok) {
      revalidatePath('/platform/creator-requests');
      return { status: 200, message: `Request ${decision === 'approve' ? 'approved' : 'rejected'}.` };
    }
    return { status: response.status, message: response.status === 403 ? 'Access denied. Platform authorization may have been revoked.' : response.status === 409 ? 'Request changed or is no longer pending. Refresh the queue.' : response.status === 401 ? 'Session expired. Sign in again.' : response.status === 400 ? 'Invalid decision or reason.' : 'Decision failed. Try again.' };
  } catch {
    return { status: 503, message: 'Decision failed. Try again.' };
  }
}
