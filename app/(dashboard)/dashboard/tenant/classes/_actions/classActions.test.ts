import { ApiError } from '@/lib/api/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/client', () => ({ apiRequest }));
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('next/cache', () => ({ revalidatePath }));

import { createClassSetup, deleteCategory, deleteClass, deleteSchedule, publishClass } from './classActions';

describe('createClassSetup', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('returns an API error without issuing follow-up requests', async () => {
    apiRequest.mockRejectedValue(new ApiError('API unavailable', 503));
    const formData = new FormData();
    formData.set('category', JSON.stringify({ name: 'Mathematics' }));
    formData.set('class', JSON.stringify({ name: 'Algebra', type: 'private', price: 250000, capacity: 1 }));
    formData.set('teacher_ids', JSON.stringify(['11111111-1111-4111-8111-111111111111']));

    const result = await createClassSetup({ success: false, message: '' }, formData);

    expect(result.success).toBe(false);
    expect(result.message).toBe('API unavailable');
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/classes/with-category', expect.objectContaining({ method: 'POST' }));
  });

  it.each([
    ['category', deleteCategory, '/api/v1/categories/category-id'],
    ['class', deleteClass, '/api/v1/classes/class-id'],
    ['schedule', deleteSchedule, '/api/v1/schedules/schedule-id'],
  ])('deletes a %s and revalidates classes data', async (_resource, action, expectedPath) => {
    apiRequest.mockResolvedValue({ status: 'success' });
    const formData = new FormData();
    formData.set('id', expectedPath.split('/').at(-1) as string);

    const result = await action({ success: false, message: '' }, formData);

    expect(result.success).toBe(true);
    expect(apiRequest).toHaveBeenCalledWith(expectedPath, { method: 'DELETE' });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/classes');
  });

  it('explains category and class conflicts', async () => {
    const formData = new FormData();
    formData.set('id', 'resource-id');

    apiRequest.mockRejectedValueOnce(new ApiError('conflict', 409));
    await expect(deleteCategory({ success: false, message: '' }, formData)).resolves.toMatchObject({
      success: false,
      message: 'Kategori masih memiliki class aktif dan tidak dapat dihapus.',
    });

    apiRequest.mockRejectedValueOnce(new ApiError('conflict', 409));
    await expect(deleteClass({ success: false, message: '' }, formData)).resolves.toMatchObject({
      success: false,
      message: 'Class masih memiliki enrollment aktif dan tidak dapat dihapus.',
    });
  });

  it.each([403, 404])('returns the API message for HTTP %s', async (status) => {
    apiRequest.mockRejectedValue(new ApiError(`status-${status}`, status));
    const formData = new FormData();
    formData.set('id', 'resource-id');

    const result = await deleteSchedule({ success: false, message: '' }, formData);

    expect(result).toMatchObject({ success: false, message: `status-${status}` });
  });

  it('returns a safe fallback when the delete request fails unexpectedly', async () => {
    apiRequest.mockRejectedValue(new Error('network failure'));
    const formData = new FormData();
    formData.set('id', 'resource-id');

    const result = await deleteSchedule({ success: false, message: '' }, formData);

    expect(result).toMatchObject({ success: false, message: 'Jadwal gagal dihapus. Silakan coba lagi.' });
  });

  it('publishes an unpublished class with the contract payload', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success', message: 'published' });
    const formData = new FormData();
    formData.set('id', 'class-id');

    await expect(publishClass({ success: false, message: '' }, formData)).resolves.toEqual({ success: true, message: 'published' });
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/classes/class-id/published', {
      method: 'PATCH',
      body: JSON.stringify({ is_published: true }),
    });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/classes');
  });
});