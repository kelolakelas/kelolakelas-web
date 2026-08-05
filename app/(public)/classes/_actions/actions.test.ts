import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiRequest }));

import { ApiError } from '@/lib/api/errors';
import { enrollInCatalogClass } from './actions';

function enrollmentForm() { const form = new FormData(); form.set('class_id', 'class-1'); form.set('student_id', 'student-1'); form.set('billing_cycle', 'monthly'); return form; }

describe('enrollInCatalogClass', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('crypto', { randomUUID: () => 'request-key-1' }); });

  it('sends only enrollment fields and an idempotency key', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success', message: 'created', data: { enrollment: { id: 'enrollment-1', status: 'pending' }, payment: { transaction_id: 'tx-1', checkout_session_url: 'https://pay.test', gross_amount: 250000, status: 'pending' } } });
    await expect(enrollInCatalogClass({ success: false, message: '' }, enrollmentForm())).resolves.toMatchObject({ success: true, payment: { checkout_session_url: 'https://pay.test' }, enrollmentId: 'enrollment-1' });
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/catalog/classes/class-1/enrollments', expect.objectContaining({ includeTenant: false, headers: { 'Idempotency-Key': 'request-key-1' }, body: JSON.stringify({ student_id: 'student-1', billing_cycle: 'monthly' }) }));
  });

  it('maps enrollment conflicts without exposing backend details', async () => {
    apiRequest.mockRejectedValueOnce(new ApiError('internal detail', 409));
    await expect(enrollInCatalogClass({ success: false, message: '' }, enrollmentForm())).resolves.toMatchObject({ success: false, status: 409, message: 'Enrollment duplikat, idempotency conflict, atau class sudah penuh.' });
  });
});