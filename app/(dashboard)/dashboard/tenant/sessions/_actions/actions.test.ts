import { ApiError } from '@/lib/api/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api/client', () => ({ apiRequest }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { cancelSession } from './actions';

describe('cancelSession', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    revalidatePath.mockReset();
  });

  it('deletes the session and revalidates affected pages', async () => {
    apiRequest.mockResolvedValue({ status: 'success' });
    const formData = new FormData();
    formData.set('sessionId', 'session-id');

    const result = await cancelSession({ success: false, message: '' }, formData);

    expect(result).toEqual({ success: true, message: 'Session berhasil dibatalkan.' });
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/sessions/session-id', { method: 'DELETE' });
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/sessions');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/sessions/session-id');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/tenant/classes');
  });

  it('rejects a missing session ID without calling the API', async () => {
    const result = await cancelSession({ success: false, message: '' }, new FormData());

    expect(result).toEqual({ success: false, message: 'Session tidak valid.' });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('returns API errors to the form', async () => {
    apiRequest.mockRejectedValue(new ApiError('Session sudah tidak dapat dibatalkan.', 409));
    const formData = new FormData();
    formData.set('sessionId', 'session-id');

    const result = await cancelSession({ success: false, message: '' }, formData);

    expect(result).toEqual({ success: false, message: 'Session sudah tidak dapat dibatalkan.' });
  });
});