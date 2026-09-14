import { describe, expect, it } from 'vitest';
import { enrollmentFormSchema, enrollmentPayload } from './enrollment';

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
