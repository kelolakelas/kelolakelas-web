// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
// Opt-in only: configuration must point to a disposable local acceptance stack.
const config: Record<string, string> = process.env.KEL197_INTEGRATION_CONFIG
  ? JSON.parse(readFileSync(process.env.KEL197_INTEGRATION_CONFIG, 'utf8'))
  : {};
if (config.gateway) { configure({asyncUtilTimeout: 10000}); vi.setConfig({testTimeout: 30000}); }
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
      fireEvent.change(screen.getByLabelText(/^Class \/ Course Name/), {
        target: { value: 'Integration class' },
      });
      fireEvent.change(screen.getByLabelText(/^Price/), {
        target: { value: '100000' },
      });
      if (privateClass)
        fireEvent.click(screen.getByRole('button', { name: /Private 1-on-1/ }));
      fireEvent.click(screen.getByRole('button', { name: /Next: Review/ }));
      await screen.findAllByRole('option', { name: 'Teacher One' });
      if (!privateClass) fireEvent.click(screen.getByRole('button', {name:'Add Slot'}));
      fireEvent.change(screen.getByLabelText(privateClass ? 'Assigned Teacher' : 'Teacher for all slots'), {target: {value: config.teacher}});
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
    it.skipIf(!config.teacher2)('persists two distinct tutors from the group timetable without extra teachers', async () => {
      renderWizard(); category(); await details();
      fireEvent.click(screen.getByRole('button', {name:'Add Slot'}));
      fireEvent.change(screen.getByLabelText('Teacher for slot 2'), {target:{value:config.teacher2}});
      expect((screen.getByLabelText('Teacher for all slots') as HTMLSelectElement).value).toBe('');
      const before = await counts();
      fireEvent.click(screen.getByRole('button', {name:/Save Complete Class/}));
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const after=await counts();
      expect(after.class_teachers-before.class_teachers).toBe(2);
      expect(after.class_schedules-before.class_schedules).toBe(2);
      const response=await fetch(`${config.gateway}/api/v1/schedules`,{headers:{Authorization:`Bearer ${config.token}`}});
      const result=await response.json();
      const slots=result.data.items.slice(-2);
      expect(new Set(slots.map((slot:{tutor_id:string})=>slot.tutor_id))).toEqual(new Set([config.teacher,config.teacher2]));
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
