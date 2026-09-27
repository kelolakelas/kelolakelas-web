import { describe, expect, it } from 'vitest';
import { enrollmentFormSchema, enrollmentPayload, isPlatformFeeRejectedResponse } from './enrollment';

describe('isPlatformFeeRejectedResponse', () => {
  it('matches only a 422 carrying the platform fee code', () => {
    expect(isPlatformFeeRejectedResponse(422, { code: 'platform_fee_exceeds_gross' })).toBe(true);
    expect(isPlatformFeeRejectedResponse(422, { code: 'duplicate_enrollment' })).toBe(false);
    expect(isPlatformFeeRejectedResponse(422, { message: 'Biaya platform melebihi jumlah pembayaran' })).toBe(false);
    expect(isPlatformFeeRejectedResponse(500, { code: 'platform_fee_exceeds_gross' })).toBe(false);
    expect(isPlatformFeeRejectedResponse(422, null)).toBe(false);
    expect(isPlatformFeeRejectedResponse(422, 'platform_fee_exceeds_gross')).toBe(false);
  });
});

describe('enrollment helpers', () => {
  it('omits an optional schedule while keeping the validated intent', () => {
    const input = enrollmentFormSchema.parse({
      student_id: '123e4567-e89b-12d3-a456-426614174000',
      billing_cycle: 'monthly',
      schedule_id: '',
      idempotency_key: '123e4567-e89b-12d3-a456-426614174001',
    });
    expect(enrollmentPayload(input)).toEqual({
      student_id: '123e4567-e89b-12d3-a456-426614174000',
      billing_cycle: 'monthly',
    });
  });

  it('rejects invalid ids and unsupported billing cycles', () => {
    expect(enrollmentFormSchema.safeParse({ student_id: 'student-1', billing_cycle: 'weekly', schedule_id: '', idempotency_key: 'key' }).success).toBe(false);
  });
});
