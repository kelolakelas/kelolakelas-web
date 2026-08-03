'use server';

import { apiRequest, getTenantCookieName } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { cookies } from 'next/headers';
import { billingSchema, type BillingTransactionResponse } from '../_lib/schema';

export interface ActionResponse { success: boolean; message: string; data?: BillingTransactionResponse; errors?: Record<string, string[]>; }

export async function createBillingTransaction(_previous: ActionResponse, formData: FormData): Promise<ActionResponse> {
  const tenantId = (await cookies()).get(getTenantCookieName())?.value || '';
  const validation = billingSchema.safeParse({ ...Object.fromEntries(formData), tenant_id: tenantId });
  if (!validation.success) return { success: false, message: 'Data pembayaran belum valid.', errors: validation.error.flatten().fieldErrors };
  try {
    const result = await apiRequest<BillingTransactionResponse>('/api/v1/billing/transactions', { method: 'POST', body: JSON.stringify(validation.data) });
    if (!result.data?.checkout_session_url) return { success: false, message: 'Gateway tidak mengembalikan checkout URL.' };
    return { success: true, message: 'Checkout siap.', data: result.data };
  } catch (error) {
    return { success: false, message: error instanceof ApiError ? error.message : 'Transaksi gagal dibuat.' };
  }
}
