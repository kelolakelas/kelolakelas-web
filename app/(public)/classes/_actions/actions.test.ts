import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiRequest }));

import { ApiError } from '@/lib/api/errors';
import { enrollInCatalogClass } from './actions';

function enrollmentForm() { const form = new FormData(); form.set('class_id', 'class-1'); form.set('student_id', 'student-1'); form.set('billing_cycle', 'monthly'); form.set('idempotency_key', 'enrollment-key-1'); return form; }

describe('enrollInCatalogClass', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends only enrollment fields and an idempotency key', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success', message: 'created', data: { enrollment: { id: 'enrollment-1', status: 'pending' }, payment: { transaction_id: 'tx-1', checkout_session_url: 'https://pay.test', gross_amount: 250000, status: 'pending' } } });
    await expect(enrollInCatalogClass({ success: false, message: '' }, enrollmentForm())).resolves.toMatchObject({ success: true, payment: { checkout_session_url: 'https://pay.test', gross_amount: 250000 }, enrollmentId: 'enrollment-1', studentId: 'student-1', billingCycle: 'monthly' });
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/catalog/classes/class-1/enrollments', expect.objectContaining({ includeTenant: false, requiresAuth: true, headers: { 'Idempotency-Key': 'enrollment-key-1' }, body: JSON.stringify({ student_id: 'student-1', billing_cycle: 'monthly' }) }));
  });

  it('returns a successful pending payment even when checkout URL is empty for actionable UI handling', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success', data: { enrollment: { id: 'enrollment-1', status: 'pending' }, payment: { transaction_id: 'tx-1', checkout_session_url: '', gross_amount: 250000, status: 'pending' } } });
    await expect(enrollInCatalogClass({ success: false, message: '' }, enrollmentForm())).resolves.toMatchObject({ success: true, payment: { checkout_session_url: '' } });
  });

  it('does not call the API for invalid form data or a missing idempotency key', async () => {
    const invalidForm = enrollmentForm();
    invalidForm.set('billing_cycle', 'weekly');
    await expect(enrollInCatalogClass({ success: false, message: '' }, invalidForm)).resolves.toMatchObject({ success: false });
    const missingKeyForm = enrollmentForm();
    missingKeyForm.delete('idempotency_key');
    await expect(enrollInCatalogClass({ success: false, message: '' }, missingKeyForm)).resolves.toMatchObject({ success: false });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'Data enrollment tidak valid.'],
    [401, 'Login diperlukan untuk enroll.'],
    [403, 'Akun ini bukan parent atau tidak memiliki izin.'],
    [404, 'Class atau student tidak ditemukan.'],
    [409, 'Enrollment duplikat, idempotency conflict, atau class sudah penuh.'],
    [422, 'Class tidak dapat di-enroll oleh student ini.'],
    [500, 'Layanan pembayaran atau akademik sedang bermasalah. Coba lagi nanti.'],
  ])('maps API status %s without exposing backend details', async (status, message) => {
    apiRequest.mockRejectedValueOnce(new ApiError('internal backend detail', status));
    await expect(enrollInCatalogClass({ success: false, message: '' }, enrollmentForm())).resolves.toMatchObject({ success: false, status, message });
  });
});