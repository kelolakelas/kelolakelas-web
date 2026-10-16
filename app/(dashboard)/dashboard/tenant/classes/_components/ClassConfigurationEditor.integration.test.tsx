// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ClassEditModal } from './ClassEditModal';
import { readClassConfiguration } from '../_actions/classActions';
const config: Record<string, string> = process.env.KEL198_INTEGRATION_CONFIG
  ? JSON.parse(readFileSync(process.env.KEL198_INTEGRATION_CONFIG, 'utf8'))
  : {};
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (key: string) =>
      key === 'auth_token' ? { value: config.token } : undefined,
  })),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
beforeEach(() => {
  if (config.gateway) vi.stubEnv('GATEWAY_API_URL', config.gateway);
});
describe.skipIf(!process.env.KEL198_INTEGRATION_CONFIG)(
  'complete editor → gateway baseline → academic → isolated enrolled PostgreSQL',
  () => {
    const permissions = [
      'class:update',
      'category:create',
      'schedule:create',
      'schedule:update',
      'schedule:delete',
    ];
    async function load() {
      const result = await readClassConfiguration(config.classID);
      expect(result.success).toBe(true);
      return result.data!;
    }
    async function open() {
      const saved = await load();
      render(
        <ClassEditModal
          classRecord={saved.class}
          categories={saved.categories}
          schedules={saved.schedules}
          permissions={permissions}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /Edit / }));
      await screen.findByLabelText('Class Name');
      return saved;
    }
    const state = async () =>
      await (await fetch(`${config.academic}/test/state`)).json();
    it('saves inline category and mutable details, then reopens stored values without repricing enrollment', async () => {
      await open();
      fireEvent.change(screen.getByLabelText('Class Name'), {
        target: { value: 'Revised class' },
      });
      fireEvent.change(screen.getByLabelText('Price'), {
        target: { value: '175000' },
      });
      fireEvent.click(
        screen.getByLabelText('Create a new category for this class'),
      );
      fireEvent.change(screen.getByLabelText('New Category Name'), {
        target: { value: 'Revised category' },
      });
      fireEvent.click(screen.getByLabelText('Published in public catalog'));
      fireEvent.change(screen.getByLabelText('Enrollment Status'), {
        target: { value: 'closed' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      await waitFor(() =>
        expect(screen.getByText(/Saved class:/).textContent).toContain(
          'Revised class',
        ),
      );
      cleanup();
      const saved = await open();
      expect(saved.class).toMatchObject({
        name: 'Revised class',
        price: 175000,
        is_published: true,
        enrollment_status: 'closed',
      });
      expect(saved.class.category?.name).toBe('Revised category');
      expect(
        (screen.getByLabelText('Class Name') as HTMLInputElement).value,
      ).toBe('Revised class');
      expect(await state()).toEqual({ gross: 200, attendance: 1 });
    });
    it('refuses capacity below reserved seats, then versions day/time/tutor/capacity/location and preserves history', async () => {
      await open();
      const section = screen
        .getByRole('button', { name: 'Save Schedule Change' })
        .closest('section')!;
      const form = within(section);
      fireEvent.change(form.getByLabelText('Capacity'), {
        target: { value: '1' },
      });
      fireEvent.click(
        form.getByRole('button', { name: 'Save Schedule Change' }),
      );
      await screen.findByRole('alert');
      await waitFor(() =>
        expect(
          form
            .getByRole('button', { name: 'Save Schedule Change' })
            .matches(':disabled'),
        ).toBe(false),
      );
      expect((await load()).schedules[0].capacity).toBe(2);
      fireEvent.change(form.getByLabelText('Capacity'), {
        target: { value: '3' },
      });
      fireEvent.change(form.getByLabelText('Location'), {
        target: { value: 'Room B' },
      });
      fireEvent.change(form.getByLabelText('Day of week'), {
        target: { value: '3' },
      });
      fireEvent.change(form.getByLabelText('Start time'), {
        target: { value: '13:00:00' },
      });
      fireEvent.change(form.getByLabelText('End time'), {
        target: { value: '14:00:00' },
      });
      const next = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      fireEvent.change(form.getByLabelText('Effective from'), {
        target: { value: next },
      });
      fireEvent.click(
        form.getByRole('button', { name: 'Save Schedule Change' }),
      );
      await waitFor(async () =>
        expect(
          (await load()).schedules.some(
            (item) => item.capacity === 3 && item.location === 'Room B',
          ),
        ).toBe(true),
      );
      const saved = await load();
      expect(saved.schedules).toHaveLength(2);
      const replacement = saved.schedules.find(
        (item) => item.location === 'Room B',
      )!;
      expect(replacement).toMatchObject({
        day_of_week: 3,
        start_time: '13:00:00',
        end_time: '14:00:00',
        tutor_id: config.teacher,
      });
      expect(await state()).toEqual({ gross: 200, attendance: 1 });
    });
    it('adds and deletes an unoccupied group schedule entirely inside Edit Class', async () => {
      const before = await open();
      const details = screen
        .getByText('Add Group Schedules')
        .closest('details')!;
      details.open = true;
      fireEvent.click(
        within(details).getByRole('button', { name: 'Save Schedules ✓' }),
      );
      await waitFor(async () =>
        expect((await load()).schedules.length).toBe(
          before.schedules.length + 1,
        ),
      );
      cleanup();
      const saved = await open();
      const added = saved.schedules.find(
        (item) => item.location === 'Room 101',
      )!;
      expect(added).toBeTruthy();
      const section = screen
        .getAllByLabelText('Location')
        .find((element) => (element as HTMLInputElement).value === 'Room 101')!
        .closest('section')!;
      fireEvent.click(
        within(section).getByRole('button', { name: 'Delete Schedule' }),
      );
      fireEvent.click(
        within(section).getByRole('button', {
          name: 'Confirm Delete Schedule',
        }),
      );
      await waitFor(async () =>
        expect(
          (await load()).schedules.some((item) => item.id === added.id),
        ).toBe(false),
      );
      expect(await state()).toEqual({ gross: 200, attendance: 1 });
    });
  },
);
