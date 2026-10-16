// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
// Opt-in only: configuration must point to a disposable local acceptance stack.
const config: Record<string, string> = process.env.KEL197_INTEGRATION_CONFIG
  ? JSON.parse(readFileSync(process.env.KEL197_INTEGRATION_CONFIG, 'utf8'))
  : {};
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (key: string) =>
      key === 'auth_token' ? { value: config.token } : undefined,
  })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { ClassCreationWizard } from './ClassCreationWizard';
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
describe.skipIf(!process.env.KEL197_INTEGRATION_CONFIG)(
  'wizard → action → existing gateway → academic main → disposable PostgreSQL',
  () => {
    const counts = async () =>
      (await (await fetch(`${config.academic}/test/counts`)).json()) as Record<
        string,
        number
      >;
    const renderWizard = () => {
      vi.stubEnv('GATEWAY_API_URL', config.gateway);
      render(
        <ClassCreationWizard
          existingCategories={[
            {
              id: config.category,
              tenant_id: config.tenant,
              name: 'Existing',
              created_at: '',
            },
          ]}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Create New Class' }));
    };
    const category = () => {
      fireEvent.change(screen.getByLabelText(/^Category Name/), {
        target: { value: 'Integration category' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Create Category' }));
    };
    const details = async (privateClass = false) => {
      await screen.findByRole('option', { name: 'Teacher One' });
      fireEvent.change(screen.getByLabelText('Assigned Teacher'), {
        target: { value: config.teacher },
      });
      fireEvent.change(screen.getByLabelText(/^Class \/ Course Name/), {
        target: { value: 'Integration class' },
      });
      fireEvent.change(screen.getByLabelText(/^Price/), {
        target: { value: '100000' },
      });
      if (privateClass)
        fireEvent.click(screen.getByRole('button', { name: /Private 1-on-1/ }));
      fireEvent.click(screen.getByRole('button', { name: /Next: Review/ }));
    };
    it('cancel at each draft step writes nothing to the database', async () => {
      const before = await counts();
      for (const step of [1, 2, 3]) {
        renderWizard();
        if (step > 1) category();
        if (step > 2) await details();
        fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
        expect(await counts()).toEqual(before);
        cleanup();
      }
    });
    it('a failed session insert rolls back every new record; retry commits complete group setup', async () => {
      const before = await counts();
      await fetch(`${config.academic}/test/failure?enable=true`, {
        method: 'POST',
      });
      try {
        renderWizard();
        category();
        await details();
        fireEvent.click(
          screen.getByRole('button', { name: /Save Complete Class/ }),
        );
        await screen.findByRole('button', { name: 'Retry Same Request' });
        expect(await counts()).toEqual(before);
        await fetch(`${config.academic}/test/failure?enable=false`, {
          method: 'POST',
        });
        fireEvent.click(
          screen.getByRole('button', { name: 'Retry Same Request' }),
        );
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        const after = await counts();
        for (const table of [
          'categories',
          'classes',
          'class_teachers',
          'class_schedules',
          'class_creation_requests',
        ])
          expect(after[table] - before[table]).toBe(1);
        expect(after.class_sessions).toBeGreaterThan(before.class_sessions);
        expect(screen.getByRole('status').textContent).toContain(
          'complete configuration',
        );
      } finally {
        await fetch(`${config.academic}/test/failure?enable=false`, {
          method: 'POST',
        });
      }
    });
    it('private final saves category/class/teacher without schedules or sessions', async () => {
      const before = await counts();
      renderWizard();
      category();
      await details(true);
      fireEvent.click(
        screen.getByRole('button', { name: /Save Complete Class/ }),
      );
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const after = await counts();
      for (const table of [
        'categories',
        'classes',
        'class_teachers',
        'class_creation_requests',
      ])
        expect(after[table] - before[table]).toBe(1);
      expect(after.class_schedules).toBe(before.class_schedules);
      expect(after.class_sessions).toBe(before.class_sessions);
    });
  },
);
