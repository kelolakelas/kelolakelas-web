'use client';

import { useActionState, useState } from 'react';
import { createTenantVoucher, updateTenantVoucher } from '../_actions/voucherActions';
import type { TenantVoucher, VoucherActionResponse } from '../_lib/schema';

interface VoucherFormProps {
  /** When set, the form edits this voucher; otherwise it creates one. */
  voucher?: TenantVoucher;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const initialState: VoucherActionResponse = {
  success: false,
  message: '',
};

function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const inputClass = (hasError: boolean) =>
  `w-full min-h-[44px] rounded-xl border bg-white dark:bg-gray-900 px-3.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-hidden focus:ring-1 transition-colors ${
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-200 dark:border-gray-800 focus:border-blue-500 focus:ring-blue-500'
  }`;

/**
 * Create/edit form for one tenant voucher (KEL-161).
 *
 * Field limits mirror `createVoucherSchema`, and the Server Action validates
 * with the same schema, so the browser cannot submit a voucher the backend
 * would reject for shape reasons. Uniqueness (case-insensitive per tenant)
 * is enforced by billing, which answers 409; that message surfaces in the
 * banner. Clearing an optional field sends nothing for it on edit, so
 * billing leaves the stored value untouched.
 */
export function VoucherForm({ voucher, onSuccess, onCancel }: VoucherFormProps) {
  const isEdit = voucher !== undefined;
  const [code, setCode] = useState(voucher?.code ?? '');
  const [discountType, setDiscountType] = useState<string>(voucher?.discount_type ?? 'percentage');
  const [discountValue, setDiscountValue] = useState(
    voucher ? String(voucher.discount_value) : ''
  );
  const [maxDiscountAmount, setMaxDiscountAmount] = useState(
    voucher?.max_discount_amount != null ? String(voucher.max_discount_amount) : ''
  );
  const [minTransactionAmount, setMinTransactionAmount] = useState(
    voucher ? String(voucher.min_transaction_amount) : ''
  );
  const [maxUses, setMaxUses] = useState(
    voucher?.max_uses != null ? String(voucher.max_uses) : ''
  );
  const [validFrom, setValidFrom] = useState(toDateTimeLocal(voucher?.valid_from));
  const [validUntil, setValidUntil] = useState(toDateTimeLocal(voucher?.valid_until));
  const [isActive, setIsActive] = useState(voucher ? voucher.is_active : true);

  const [state, formAction, isPending] = useActionState(
    async (previousState: VoucherActionResponse, formData: FormData) => {
      const nextState = isEdit
        ? await updateTenantVoucher(previousState, formData)
        : await createTenantVoucher(previousState, formData);
      if (nextState.success) {
        onSuccess?.();
      }
      return nextState;
    },
    initialState
  );

  const errorFor = (field: string) => state.errors?.[field]?.[0];

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="voucherId" value={voucher.id} />}

      {state.message && (
        <div
          role={state.success ? 'status' : 'alert'}
          className={`rounded-2xl border p-4 text-xs font-medium ${
            state.success
              ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
              : 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
          }`}
        >
          <span className="font-semibold">{state.success ? 'Success: ' : 'Error: '}</span>
          {state.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor={isEdit ? `voucher-code-${voucher.id}` : 'voucher-code'} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Code <span className="text-red-500">*</span>
          </label>
          <input
            id={isEdit ? `voucher-code-${voucher.id}` : 'voucher-code'}
            type="text"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. HEMAT10"
            maxLength={255}
            required={!isEdit}
            className={inputClass(!!errorFor('code'))}
          />
          {errorFor('code') && <p className="text-[11px] text-red-500 mt-1">{errorFor('code')}</p>}
          <p className="text-[11px] text-gray-400">Unique per tenant, case-insensitive.</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={isEdit ? `voucher-type-${voucher.id}` : 'voucher-type'} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Discount type <span className="text-red-500">*</span>
          </label>
          <select
            id={isEdit ? `voucher-type-${voucher.id}` : 'voucher-type'}
            name="discount_type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value)}
            required={!isEdit}
            className={inputClass(!!errorFor('discount_type'))}
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed_amount">Fixed amount (Rp)</option>
          </select>
          {errorFor('discount_type') && (
            <p className="text-[11px] text-red-500 mt-1">{errorFor('discount_type')}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={isEdit ? `voucher-value-${voucher.id}` : 'voucher-value'} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Discount value <span className="text-red-500">*</span>
          </label>
          <input
            id={isEdit ? `voucher-value-${voucher.id}` : 'voucher-value'}
            type="number"
            name="discount_value"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === 'percentage' ? '1 - 100' : 'e.g. 15000'}
            min={0}
            step="any"
            required={!isEdit}
            className={inputClass(!!errorFor('discount_value'))}
          />
          {errorFor('discount_value') && (
            <p className="text-[11px] text-red-500 mt-1">{errorFor('discount_value')}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={isEdit ? `voucher-min-${voucher.id}` : 'voucher-min'} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Minimum transaction (Rp)
          </label>
          <input
            id={isEdit ? `voucher-min-${voucher.id}` : 'voucher-min'}
            type="number"
            name="min_transaction_amount"
            value={minTransactionAmount}
            onChange={(e) => setMinTransactionAmount(e.target.value)}
            placeholder="0"
            min={0}
            step={1}
            className={inputClass(!!errorFor('min_transaction_amount'))}
          />
          {errorFor('min_transaction_amount') && (
            <p className="text-[11px] text-red-500 mt-1">{errorFor('min_transaction_amount')}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={isEdit ? `voucher-maxdisc-${voucher.id}` : 'voucher-maxdisc'} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Maximum discount (Rp)
          </label>
          <input
            id={isEdit ? `voucher-maxdisc-${voucher.id}` : 'voucher-maxdisc'}
            type="number"
            name="max_discount_amount"
            value={maxDiscountAmount}
            onChange={(e) => setMaxDiscountAmount(e.target.value)}
            placeholder="No cap"
            min={1}
            step={1}
            className={inputClass(!!errorFor('max_discount_amount'))}
          />
          {errorFor('max_discount_amount') && (
            <p className="text-[11px] text-red-500 mt-1">{errorFor('max_discount_amount')}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={isEdit ? `voucher-maxuses-${voucher.id}` : 'voucher-maxuses'} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Maximum uses
          </label>
          <input
            id={isEdit ? `voucher-maxuses-${voucher.id}` : 'voucher-maxuses'}
            type="number"
            name="max_uses"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder={voucher ? `Used ${voucher.current_uses}× so far` : 'Unlimited'}
            min={1}
            step={1}
            className={inputClass(!!errorFor('max_uses'))}
          />
          {errorFor('max_uses') && (
            <p className="text-[11px] text-red-500 mt-1">{errorFor('max_uses')}</p>
          )}
          {isEdit && (
            <p className="text-[11px] text-gray-400">
              Cannot go below the {voucher.current_uses}× already used.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={isEdit ? `voucher-from-${voucher.id}` : 'voucher-from'} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Valid from
          </label>
          <input
            id={isEdit ? `voucher-from-${voucher.id}` : 'voucher-from'}
            type="datetime-local"
            name="valid_from"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className={inputClass(!!errorFor('valid_from'))}
          />
          {errorFor('valid_from') && (
            <p className="text-[11px] text-red-500 mt-1">{errorFor('valid_from')}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={isEdit ? `voucher-until-${voucher.id}` : 'voucher-until'} className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Valid until
          </label>
          <input
            id={isEdit ? `voucher-until-${voucher.id}` : 'voucher-until'}
            type="datetime-local"
            name="valid_until"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={inputClass(!!errorFor('valid_until'))}
          />
          {errorFor('valid_until') && (
            <p className="text-[11px] text-red-500 mt-1">{errorFor('valid_until')}</p>
          )}
        </div>
      </div>

      {isEdit && (
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-3">
          <input
            id={`voucher-active-${voucher.id}`}
            type="checkbox"
            name="is_active"
            value="true"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded accent-blue-600"
          />
          {/* An unchecked checkbox submits nothing, so the hidden field pins
              the explicit false: deactivation must survive as a value, not as
              an omission the action would treat as "leave unchanged". */}
          {!isActive && <input type="hidden" name="is_active" value="false" />}
          <label htmlFor={`voucher-active-${voucher.id}`} className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Active
            <span className="block font-normal text-gray-500 dark:text-gray-400">
              Turn off to deactivate instead of deleting — required once the voucher has been used.
            </span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="min-h-[44px] rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create voucher'}
        </button>
      </div>
    </form>
  );
}
