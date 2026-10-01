'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import {
  TENANT_VOUCHERS_PATH,
  createVoucherSchema,
  updateVoucherSchema,
  voucherMutationErrorMessage,
  type VoucherActionResponse,
} from '../_lib/schema';

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';
const TENANT_COOKIE = process.env.TENANT_ID_COOKIE_NAME || 'tenant_id';

/**
 * Extracts authorization and tenant headers from server cookies.
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
 * Reads the backend JSON envelope without letting a non-JSON body (e.g. a proxy
 * error page) turn a mapped 403/404/409 into an unexpected network error.
 */
async function readEnvelope(
  response: Response
): Promise<{ status?: string; message?: string; data?: unknown } | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function revalidateVoucherPaths() {
  revalidatePath(TENANT_VOUCHERS_PATH);
  revalidatePath('/(dashboard)/tenant/vouchers');
}

function toIsoOrUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Server Action: Create a tenant voucher.
 * Target Endpoint: POST /api/v1/billing/vouchers
 */
export async function createTenantVoucher(
  _prevState: VoucherActionResponse,
  formData: FormData
): Promise<VoucherActionResponse> {
  const rawData = {
    code: formData.get('code'),
    discount_type: formData.get('discount_type'),
    discount_value: formData.get('discount_value'),
    max_discount_amount: formData.get('max_discount_amount') ?? undefined,
    min_transaction_amount: formData.get('min_transaction_amount') ?? undefined,
    max_uses: formData.get('max_uses') ?? undefined,
    valid_from: formData.get('valid_from') ?? undefined,
    valid_until: formData.get('valid_until') ?? undefined,
  };

  const validation = createVoucherSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const input = validation.data;
  try {
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(`${baseUrl}/api/v1/billing/vouchers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: input.code,
        discount_type: input.discount_type,
        discount_value: input.discount_value,
        max_discount_amount: input.max_discount_amount,
        min_transaction_amount: input.min_transaction_amount ?? 0,
        max_uses: input.max_uses,
        valid_from: toIsoOrUndefined(input.valid_from),
        valid_until: toIsoOrUndefined(input.valid_until),
        is_active: true,
      }),
      cache: 'no-store',
    });

    const result = await readEnvelope(response);
    if (!response.ok || result?.status !== 'success') {
      return {
        success: false,
        message: voucherMutationErrorMessage('create', response.status, result?.message),
      };
    }

    revalidateVoucherPaths();
    return {
      success: true,
      message: `Voucher "${input.code}" was created successfully.`,
      data: result?.data,
    };
  } catch (error) {
    console.error('[createTenantVoucher Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network error occurred while creating the voucher.',
    };
  }
}

/**
 * Server Action: Update a tenant voucher's fields, or deactivate it.
 * Target Endpoint: PATCH /api/v1/billing/vouchers/:id
 *
 * Uses `updateVoucherSchema`, which applies the same field rules as the
 * creation form, so an edit cannot save a voucher the creation form would
 * reject. Only the supplied fields change; deactivation is an update with
 * `is_active` false, never a delete.
 */
export async function updateTenantVoucher(
  _prevState: VoucherActionResponse,
  formData: FormData
): Promise<VoucherActionResponse> {
  const rawData = {
    voucherId: formData.get('voucherId'),
    code: formData.get('code') ?? undefined,
    discount_type: formData.get('discount_type') ?? undefined,
    discount_value: formData.get('discount_value') ?? undefined,
    max_discount_amount: formData.get('max_discount_amount') ?? undefined,
    min_transaction_amount: formData.get('min_transaction_amount') ?? undefined,
    max_uses: formData.get('max_uses') ?? undefined,
    valid_from: formData.get('valid_from') ?? undefined,
    valid_until: formData.get('valid_until') ?? undefined,
    is_active: formData.get('is_active') ?? undefined,
  };

  const validation = updateVoucherSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  const { voucherId, ...fields } = validation.data;
  const body: Record<string, unknown> = {};
  if (fields.code !== undefined) body.code = fields.code;
  if (fields.discount_type !== undefined) body.discount_type = fields.discount_type;
  if (fields.discount_value !== undefined) body.discount_value = fields.discount_value;
  if (fields.max_discount_amount !== undefined) body.max_discount_amount = fields.max_discount_amount;
  if (fields.min_transaction_amount !== undefined) body.min_transaction_amount = fields.min_transaction_amount;
  if (fields.max_uses !== undefined) body.max_uses = fields.max_uses;
  if (fields.valid_from !== undefined) body.valid_from = toIsoOrUndefined(fields.valid_from);
  if (fields.valid_until !== undefined) body.valid_until = toIsoOrUndefined(fields.valid_until);
  if (fields.is_active !== undefined) body.is_active = fields.is_active;

  if (Object.keys(body).length === 0) {
    return { success: false, message: 'No changes to save.' };
  }

  try {
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${baseUrl}/api/v1/billing/vouchers/${encodeURIComponent(voucherId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store',
      }
    );

    const result = await readEnvelope(response);
    if (!response.ok || result?.status !== 'success') {
      // No revalidation on refusal: a 404 refresh would unmount this
      // voucher's row (and the message with it) before the tenant can read why.
      return {
        success: false,
        message: voucherMutationErrorMessage('update', response.status, result?.message),
      };
    }

    revalidateVoucherPaths();
    return {
      success: true,
      message: 'Voucher was updated successfully.',
      data: result?.data,
    };
  } catch (error) {
    console.error('[updateTenantVoucher Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network error occurred while updating the voucher.',
    };
  }
}

/**
 * Server Action: Delete a tenant voucher that was never used.
 * Target Endpoint: DELETE /api/v1/billing/vouchers/:id
 *
 * The backend refuses with 409 while the voucher already discounted a
 * transaction; the voucher then stays in the list and the tenant sees that
 * reason with a hint to deactivate it instead.
 */
export async function deleteTenantVoucher(
  _prevState: VoucherActionResponse,
  formData: FormData
): Promise<VoucherActionResponse> {
  const voucherId = String(formData.get('voucherId') ?? '').trim();
  const voucherCode = String(formData.get('voucherCode') ?? '').trim();

  if (!voucherId) {
    return { success: false, message: 'Voucher ID is required.' };
  }

  try {
    const baseUrl = getGatewayBaseUrl();
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${baseUrl}/api/v1/billing/vouchers/${encodeURIComponent(voucherId)}`,
      {
        method: 'DELETE',
        headers,
        cache: 'no-store',
      }
    );

    const result = await readEnvelope(response);
    if (!response.ok || result?.status !== 'success') {
      return {
        success: false,
        message: voucherMutationErrorMessage('delete', response.status, result?.message),
      };
    }

    revalidateVoucherPaths();
    return {
      success: true,
      message: voucherCode
        ? `Voucher "${voucherCode}" was deleted successfully.`
        : 'Voucher was deleted successfully.',
    };
  } catch (error) {
    console.error('[deleteTenantVoucher Error]:', error);
    return {
      success: false,
      message:
        getGatewayConfigurationErrorMessage(error) ||
        'An unexpected network error occurred while deleting the voucher.',
    };
  }
}
