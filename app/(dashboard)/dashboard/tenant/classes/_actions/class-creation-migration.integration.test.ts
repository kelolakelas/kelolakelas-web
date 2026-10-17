import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
const config: Record<string, string> = process.env.KEL204_INTEGRATION_CONFIG
  ? JSON.parse(readFileSync(process.env.KEL204_INTEGRATION_CONFIG, 'utf8')) : {};
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (key: string) => key === 'auth_token' ? { value: config.token } : undefined }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { createClassConfiguration } from './classActions';
import type { ClassCreationInput } from '../_lib/class-creation';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe.skipIf(!process.env.KEL204_INTEGRATION_CONFIG)('action → gateway → academic → migration-backed PostgreSQL', () => {
  it('recovers the same request after migration, preserves atomic failure, and deduplicates lost responses/concurrent retries', async () => {
    vi.stubEnv('GATEWAY_API_URL', config.gateway);
    const counts = async () => (await (await fetch(`${config.academic}/test/counts`)).json()) as Record<string, number>;
    const payload: ClassCreationInput = { category_id: config.category, class: { name: 'Migration seam group', type: 'group', price: 100000 }, teacher_ids: [config.teacher], schedules: [{ day_of_week: 1, start_time: '09:00', end_time: '10:00', capacity: 10, tutor_id: config.teacher }] };
    const before = await counts();
    // Fixture begins at the deployed payment-method version, without retry storage.
    const key = crypto.randomUUID();
    expect(await createClassConfiguration(payload, key)).toMatchObject({ success: false, retrySameRequest: true });
    expect(await counts()).toEqual(before);
    expect((await fetch(`${config.academic}/test/migrate`, { method: 'POST' })).status).toBe(204);
    const saved = await createClassConfiguration(payload, key);
    expect(saved.success).toBe(true);
    const replay = await Promise.all(Array.from({ length: 4 }, () => createClassConfiguration(payload, key)));
    for (const result of replay) expect(result.data?.class.id).toBe(saved.data?.class.id);
    expect((await counts()).classes - before.classes).toBe(1);
    const newCategory = { ...payload, category_id: undefined, category: { name: 'New migration category' } };
    const failureBefore = await counts();
    expect((await fetch(`${config.academic}/test/failure?enable=true`, { method: 'POST' })).status).toBe(204);
    const failureKey = crypto.randomUUID();
    try {
      expect(await createClassConfiguration(newCategory, failureKey)).toMatchObject({ success: false, retrySameRequest: true });
      expect(await counts()).toEqual(failureBefore);
    } finally {
      await fetch(`${config.academic}/test/failure?enable=false`, { method: 'POST' });
    }
    expect((await createClassConfiguration(newCategory, failureKey)).success).toBe(true);
    const realFetch = globalThis.fetch;
    const lostKey = crypto.randomUUID();
    let lost = false;
    vi.stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => {
      const response = await realFetch(...args);
      if (!lost && String(args[0]).endsWith('/classes/with-category') && response.ok) { lost = true; throw new Error('injected response loss after commit'); }
      return response;
    });
    const privatePayload = { ...payload, class: { ...payload.class, name: 'Migration private', type: 'private' as const }, schedules: [] };
    try {
      expect(await createClassConfiguration(privatePayload, lostKey)).toMatchObject({ success: false, retrySameRequest: true });
      expect((await createClassConfiguration(privatePayload, lostKey)).success).toBe(true);
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
    const after = await counts();
    expect(after.classes - before.classes).toBe(3);
    expect(after.categories - before.categories).toBe(1);
    expect(after.class_schedules - before.class_schedules).toBe(2);
  }, 120000);
});
