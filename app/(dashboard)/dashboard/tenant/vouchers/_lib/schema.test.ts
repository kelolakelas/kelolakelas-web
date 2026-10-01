import { describe, expect, it } from 'vitest';
import { createVoucherSchema, updateVoucherSchema, voucherDiscountLabel, voucherMutationErrorMessage, voucherUsageLabel } from './schema';

const valid = {
  code: 'HEMAT10', discount_type: 'percentage', discount_value: '10',
  max_discount_amount: '', min_transaction_amount: '0', max_uses: '10',
  valid_from: '2026-10-01T09:00', valid_until: '2026-10-31T09:00',
};

describe('voucher form validation', () => {
  it('accepts a valid percentage and a positive nominal discount', () => {
    expect(createVoucherSchema.safeParse(valid).success).toBe(true);
    expect(createVoucherSchema.safeParse({ ...valid, discount_type: 'fixed_amount', discount_value: '15000' }).success).toBe(true);
  });
  it('rejects blank codes, invalid values and inverted dates', () => {
    for (const candidate of [
      { ...valid, code: ' ' },
      { ...valid, discount_value: '101' },
      { ...valid, discount_value: '0' },
      { ...valid, discount_type: 'fixed_amount', discount_value: '-10' },
      { ...valid, valid_until: '2026-09-01T09:00' },
      { ...valid, max_uses: '0' },
    ]) expect(createVoucherSchema.safeParse(candidate).success).toBe(false);
  });
  it('permits deactivation and reactivation of an expired voucher', () => {
    expect(updateVoucherSchema.safeParse({ voucherId: 'a', is_active: 'false' }).success).toBe(true);
    expect(updateVoucherSchema.safeParse({ voucherId: 'a', is_active: 'true' }).success).toBe(true);
  });
  it('reports deletion conflicts clearly', () => {
    expect(voucherMutationErrorMessage('delete', 409)).toContain('deactivated');
    expect(voucherMutationErrorMessage('create', 409, 'voucher code already exists')).toContain('already exists');
    expect(voucherMutationErrorMessage('update', 404)).toContain('no longer exists');
  });
  it('shows discount and usage count', () => {
    expect(voucherDiscountLabel({ discount_type: 'percentage', discount_value: 10 })).toBe('10%');
    expect(voucherUsageLabel({ current_uses: 3, max_uses: 10 })).toBe('3/10');
  });
});
