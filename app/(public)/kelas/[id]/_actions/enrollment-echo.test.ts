import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrollInClass } from '@/app/(public)/kelas/[id]/_actions/actions';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: parentToken() }) }) }));
vi.mock('@/lib/gateway', () => ({
  getGatewayBaseUrl: () => 'http://gateway.test',
  withGatewayClientIp: async (headers: unknown) => headers,
  getGatewayConfigurationErrorMessage: () => null,
}));
vi.mock('@/lib/payment-instructions', () => ({
  getCheckoutInstructions: async () => ({
    data: {
      channel: 'VA',
      merchantOrderId: '423e4567-e89b-12d3-a456-426614174001',
      amount: 150000,
      currency: 'IDR',
      instructions: { kind: 'va', channelLabel: 'Virtual Account', vaNumber: '88001234', expiresLabel: '1 Jan 2100' },
      qrImage: null,
    },
    error: null,
  }),
}));

function parentToken(): string {
  const payload = Buffer.from(JSON.stringify({ user_id: STUDENT_ID, is_parent: true })).toString('base64url');
  return `header.${payload}.sig`;
}

const CLASS_ID = '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11';
const STUDENT_ID = '123e4567-e89b-12d3-a456-426614174000';
const SCHEDULE_ID = '223e4567-e89b-12d3-a456-426614174000';
const KEY = '323e4567-e89b-12d3-a456-426614174000';
const initial = { success: false, message: '' };

function quarterlyQrisForm() {
  const form = new FormData();
  form.set('student_id', STUDENT_ID);
  form.set('schedule_id', SCHEDULE_ID);
  form.set('billing_cycle', 'quarterly');
  form.set('payment_method', 'NQ');
  form.set('voucher_code', 'HEMAT');
  form.set('idempotency_key', KEY);
  return form;
}

function yearlyVaForm() {
  const form = new FormData();
  form.set('student_id', STUDENT_ID);
  form.set('schedule_id', SCHEDULE_ID);
  form.set('billing_cycle', 'yearly');
  form.set('payment_method', 'VA');
  form.set('idempotency_key', KEY);
  return form;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
});

describe('enrollInClass echoes the last submission on failure (KEL-194)', () => {
  it('validation failure keeps quarterly+QRIS and the voucher', async () => {
    const form = quarterlyQrisForm();
    form.set('student_id', 'bukan-uuid');
    const result = await enrollInClass(CLASS_ID, initial, form);
    expect(result.success).toBe(false);
    expect(result.values).toEqual({
      student_id: 'bukan-uuid',
      schedule_id: SCHEDULE_ID,
      billing_cycle: 'quarterly',
      payment_method: 'NQ',
      voucher_code: 'HEMAT',
    });
  });

  it('backend 500 keeps yearly+VA so the retry carries the same intent', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ status: 'error', message: 'rusak' }), { status: 500 }));
    const result = await enrollInClass(CLASS_ID, initial, yearlyVaForm());
    expect(result.success).toBe(false);
    expect(result.values).toEqual({
      student_id: STUDENT_ID,
      schedule_id: SCHEDULE_ID,
      billing_cycle: 'yearly',
      payment_method: 'VA',
      voucher_code: '',
    });
  });

  it('conflict 409 keeps quarterly+QRIS with the recovery link', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ status: 'error', message: 'penuh' }), { status: 409 }));
    const result = await enrollInClass(CLASS_ID, initial, quarterlyQrisForm());
    expect(result.success).toBe(false);
    expect(result.message).toContain('Jadwal penuh');
    expect(result.values?.billing_cycle).toBe('quarterly');
    expect(result.values?.payment_method).toBe('NQ');
  });

  it('network failure keeps the submission instead of dropping it', async () => {
    mocks.fetch.mockRejectedValue(new Error('offline'));
    const result = await enrollInClass(CLASS_ID, initial, quarterlyQrisForm());
    expect(result.success).toBe(false);
    expect(result.values?.schedule_id).toBe(SCHEDULE_ID);
    expect(result.values?.payment_method).toBe('NQ');
  });

  it('happy path carries no echo values', async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          data: {
            enrollment: { id: '423e4567-e89b-12d3-a456-426614174000' },
            payment: { checkout_session_url: 'https://pay.example.test/session' },
          },
        }),
      ),
    );
    const result = await enrollInClass(CLASS_ID, initial, yearlyVaForm());
    expect(result.success).toBe(true);
    expect(result).not.toHaveProperty('values');
  });
});
