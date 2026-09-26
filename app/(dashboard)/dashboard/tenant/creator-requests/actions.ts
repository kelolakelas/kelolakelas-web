'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl } from '@/lib/gateway';
import { callerMatchesScope } from '@/lib/creator-requests';

export type CreatorActionState = { status: number; message: string };

export async function requestCreator(_previous: CreatorActionState, form: FormData): Promise<CreatorActionState> {
  const jar = await cookies();
  const token = jar.get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  const tenant = jar.get(process.env.TENANT_ID_COOKIE_NAME || 'tenant_id')?.value;
  if (!token) return { status: 401, message: 'Session expired. Sign in again.' };
  if (!tenant || !callerMatchesScope(token, false, tenant)) return { status: 403, message: 'Tenant access required.' };
  // The token's Creator role is never trusted here: identity verifies live membership on every POST.
  const email = form.get('target_email');
  const reason = form.get('reason');
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 255 || typeof reason !== 'string' || !reason.trim() || reason.length > 2000) {
    return { status: 400, message: 'Enter a valid email and a reason (up to 2000 characters).' };
  }
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/creator-requests`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenant, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_email: email.trim(), reason: reason.trim() }), cache: 'no-store',
    });
    if (response.status === 201) {
      revalidatePath('/dashboard/tenant/creator-requests');
      return { status: 201, message: 'Creator request submitted.' };
    }
    return { status: response.status, message: response.status === 403 ? 'Access denied. Active Creator membership required.' : response.status === 409 ? 'A pending request already exists or the target is already a Creator.' : response.status === 401 ? 'Session expired. Sign in again.' : response.status === 400 ? 'Invalid target or reason.' : 'Could not submit request. Try again.' };
  } catch {
    return { status: 503, message: 'Could not submit request. Try again.' };
  }
}
