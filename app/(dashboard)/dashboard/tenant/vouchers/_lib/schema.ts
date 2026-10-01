import { z } from 'zod';
import type { ListPagination } from '@/lib/list-envelope';

/**
 * Types, vocabulary, and pure helpers for the tenant voucher screen (KEL-161).
 *
 * Everything here is synchronous and side effect free so parsing, validation,
 * and presentation can be unit tested without a gateway or a request context.
 * The asynchronous gateway reads live in `../_queries/queries.ts` and the
 * mutations in `../_actions/voucherActions.ts`.
 *
 * The contract is proxied unchanged by the API gateway:
 * `GET/POST /api/v1/billing/vouchers` and `GET/PATCH/DELETE
 * /api/v1/billing/vouchers/:id` (billing, guarded by `voucher:*`). The list
 * answers the paginated `{ items, pagination }` envelope.
 */

/** Canonical path of this screen, used by links and the form. */
export const TENANT_VOUCHERS_PATH = '/dashboard/tenant/vouchers';

/** Rows per vouchers page. 20 matches the billing service default. */
export const VOUCHER_PAGE_SIZE = 20;

/** Discount kinds accepted by billing (`domain.VoucherDiscount*`). */
export const voucherDiscountTypeSchema = z.enum(['percentage', 'fixed_amount']);

export type VoucherDiscountType = z.infer<typeof voucherDiscountTypeSchema>;

/**
 * Voucher row as billing returns it, including the usage count the list
 * shows next to every row.
 */
export const voucherSchema = z.object({
  id: z.string(),
  code: z.string(),
  discount_type: voucherDiscountTypeSchema,
  discount_value: z.number(),
  max_discount_amount: z.number().nullable().optional(),
  min_transaction_amount: z.number(),
  max_uses: z.number().nullable().optional(),
  current_uses: z.number(),
  valid_from: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TenantVoucher = z.infer<typeof voucherSchema>;

/**
 * Standardized Action Response Interface for Server Actions.
 */
export interface VoucherActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: unknown;
}

const codeField = z
  .string()
  .trim()
  .min(1, 'Voucher code is required.')
  .max(255, 'Voucher code must not exceed 255 characters.');

const discountValueField = z.coerce
  .number({ error: 'Discount value must be a number.' })
  .refine((value) => Number.isFinite(value), 'Discount value must be a number.');

const optionalIntField = z
  .string()
  .trim()
  .optional()
  .transform((raw) => {
    if (raw === undefined || raw === '') return undefined;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) ? parsed : NaN;
  })
  .refine((value) => value === undefined || (Number.isInteger(value) && (value as number) >= 0), {
    message: 'Must be a non-negative whole number.',
  });

const optionalDateTimeField = z
  .string()
  .trim()
  .optional()
  .transform((raw) => (raw === undefined || raw === '' ? undefined : raw))
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: 'Must be a valid date and time.',
  });

const voucherDateRangeRefine = (value: { valid_from?: string; valid_until?: string }) => {
  if (value.valid_from && value.valid_until) {
    return Date.parse(value.valid_until) >= Date.parse(value.valid_from);
  }
  return true;
};

const dateRangeMessage = 'Valid-until must be on or after valid-from.';

/**
 * Zod schema for creating a tenant voucher.
 *
 * Field rules mirror billing's `ValidateVoucherFields`: a percentage takes
 * 1-100, a nominal takes a positive amount, and the date range must be
 * ordered. Uniqueness (case-insensitive per tenant) is enforced by billing,
 * which answers 409; the action surfaces that message.
 */
export const createVoucherSchema = z
  .object({
    code: codeField,
    discount_type: voucherDiscountTypeSchema,
    discount_value: discountValueField,
    max_discount_amount: optionalIntField,
    min_transaction_amount: optionalIntField,
    max_uses: optionalIntField,
    valid_from: optionalDateTimeField,
    valid_until: optionalDateTimeField,
  })
  .superRefine((value, ctx) => {
    if (value.discount_type === 'percentage' && (value.discount_value < 1 || value.discount_value > 100)) {
      ctx.addIssue({ code: 'custom', path: ['discount_value'], message: 'Percentage must be between 1 and 100.' });
    }
    if (value.discount_type === 'fixed_amount' && value.discount_value <= 0) {
      ctx.addIssue({ code: 'custom', path: ['discount_value'], message: 'Nominal amount must be positive.' });
    }
    if (
      value.max_discount_amount !== undefined &&
      !(value.max_discount_amount as number > 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_discount_amount'],
        message: 'Maximum discount must be positive.',
      });
    }
    if (value.max_uses !== undefined && !(value.max_uses as number > 0)) {
      ctx.addIssue({ code: 'custom', path: ['max_uses'], message: 'Maximum uses must be positive.' });
    }
    if (!voucherDateRangeRefine(value)) {
      ctx.addIssue({ code: 'custom', path: ['valid_until'], message: dateRangeMessage });
    }
  });

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>;

/**
 * Zod schema for updating a tenant voucher. Every field is optional because
 * the form only sends what the tenant changed; billing leaves the rest
 * untouched. Reactivating an expired voucher is allowed, so no validity check
 * runs on the toggle — only the range ordering is enforced when both ends
 * are supplied.
 */
export const updateVoucherSchema = z
  .object({
    voucherId: z.string().trim().min(1, 'Voucher ID is required.'),
    code: z.string().trim().max(255, 'Voucher code must not exceed 255 characters.').optional(),
    discount_type: voucherDiscountTypeSchema.optional(),
    discount_value: z.coerce.number().optional(),
    max_discount_amount: optionalIntField,
    min_transaction_amount: optionalIntField,
    max_uses: optionalIntField,
    valid_from: optionalDateTimeField,
    valid_until: optionalDateTimeField,
    is_active: z
      .string()
      .trim()
      .optional()
      .transform((raw) => {
        if (raw === undefined || raw === '') return undefined;
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        return raw;
      }),
  })
  .superRefine((value, ctx) => {
    if (value.code !== undefined && value.code.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['code'], message: 'Voucher code is required.' });
    }
    if (
      value.discount_type === 'percentage' &&
      value.discount_value !== undefined &&
      (value.discount_value < 1 || value.discount_value > 100)
    ) {
      ctx.addIssue({ code: 'custom', path: ['discount_value'], message: 'Percentage must be between 1 and 100.' });
    }
    if (
      value.discount_type === 'fixed_amount' &&
      value.discount_value !== undefined &&
      value.discount_value <= 0
    ) {
      ctx.addIssue({ code: 'custom', path: ['discount_value'], message: 'Nominal amount must be positive.' });
    }
    if (value.discount_type === undefined && value.discount_value !== undefined && value.discount_value <= 0) {
      ctx.addIssue({ code: 'custom', path: ['discount_value'], message: 'Discount value must be positive.' });
    }
    if (
      value.max_discount_amount !== undefined &&
      !(value.max_discount_amount as number > 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_discount_amount'],
        message: 'Maximum discount must be positive.',
      });
    }
    if (value.max_uses !== undefined && !(value.max_uses as number > 0)) {
      ctx.addIssue({ code: 'custom', path: ['max_uses'], message: 'Maximum uses must be positive.' });
    }
    if (typeof value.is_active !== 'boolean' && value.is_active !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['is_active'], message: 'Status must be active or inactive.' });
    }
    if (!voucherDateRangeRefine(value)) {
      ctx.addIssue({ code: 'custom', path: ['valid_until'], message: dateRangeMessage });
    }
  });

export type UpdateVoucherInput = z.infer<typeof updateVoucherSchema>;

function firstValue(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return '';
}

/**
 * Reads the `page` query parameter into the page requested from billing.
 * A value that is not a positive integer falls back to the first page.
 */
export function parseVoucherPage(input: Record<string, string | string[] | undefined>): number {
  const rawPage = firstValue(input.page).trim();
  const page = Number(rawPage);
  return /^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(page) ? page : 1;
}

/**
 * Query string for the billing voucher list. `page_size` is always sent so
 * the screen never silently follows a service default change.
 */
export function voucherQueryString(page: number): string {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(VOUCHER_PAGE_SIZE),
  });
  return params.toString();
}

/**
 * Human-readable discount label for one row, e.g. `10%` or `Rp15.000`.
 */
export function voucherDiscountLabel(voucher: Pick<TenantVoucher, 'discount_type' | 'discount_value'>): string {
  if (voucher.discount_type === 'percentage') {
    return `${voucher.discount_value}%`;
  }
  return `Rp${Math.round(voucher.discount_value).toLocaleString('id-ID')}`;
}

/**
 * Human-readable usage label, e.g. `3/10` or `3/∞` for an uncapped voucher.
 */
export function voucherUsageLabel(
  voucher: Pick<TenantVoucher, 'current_uses' | 'max_uses'>
): string {
  const cap = voucher.max_uses ?? null;
  return `${voucher.current_uses}/${cap === null ? '∞' : cap}`;
}

export type { ListPagination };

export type VoucherMutation = 'create' | 'update' | 'delete';

/**
 * Maps a refused voucher mutation to a message the tenant can act on (KEL-161).
 *
 * 403 and 404 get fixed wording because the backend text for them is terse or
 * internal ("Permission denied", "Voucher not found"). 409 keeps the backend
 * message, which already states the conflict (code taken, or the voucher was
 * already used and can only be deactivated), and falls back to equivalent
 * wording when the body carries none.
 */
export function voucherMutationErrorMessage(
  mutation: VoucherMutation,
  status: number,
  backendMessage?: string
): string {
  if (status === 403) {
    return mutation === 'create'
      ? 'You do not have permission to create vouchers.'
      : mutation === 'update'
        ? 'You do not have permission to edit this voucher.'
        : 'You do not have permission to delete this voucher.';
  }
  if (status === 404) {
    return 'This voucher no longer exists. It may have been deleted in another session. Refresh the page to see the current vouchers.';
  }
  if (status === 409) {
    if (backendMessage) {
      return backendMessage;
    }
    return mutation === 'delete'
      ? 'This voucher has already been used and can only be deactivated.'
      : 'Another voucher already uses this code. Choose a different code.';
  }
  return (
    backendMessage ||
    (mutation === 'create'
      ? 'Failed to create voucher. Please verify inputs and try again.'
      : mutation === 'update'
        ? 'Failed to update voucher. Please verify inputs and try again.'
        : 'Failed to delete voucher. Please try again.')
  );
}
