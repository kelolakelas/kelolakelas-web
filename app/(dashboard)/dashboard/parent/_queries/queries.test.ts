import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiRequest, unwrapList: (data: unknown) => ({ data }) }));

import { ApiError } from '@/lib/api/errors';
import { getParentTransaction } from './queries';

describe('getParentTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the parent-scoped detail endpoint without tenant context', async () => {
    apiRequest.mockResolvedValueOnce({ status: 'success', data: { id: 'tx-1', gross_amount: 250000, status: 'pending' } });
    await expect(getParentTransaction('tx-1')).resolves.toMatchObject({ data: { id: 'tx-1' } });
    expect(apiRequest).toHaveBeenCalledWith('/api/v1/billing/transactions/tx-1', { includeTenant: false, requiresAuth: true });
  });

  it.each([401, 404, 500])('maps API error %s without exposing backend details', async (status) => {
    apiRequest.mockRejectedValueOnce(new ApiError('internal backend detail', status));
    const result = await getParentTransaction('tx-1');
    expect(result.status).toBe(status);
    expect(result.error).not.toContain('internal backend detail');
  });
});