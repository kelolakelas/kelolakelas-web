// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
const actions = vi.hoisted(() => ({
  updateClass: vi.fn(),
  createSchedule: vi.fn(),
  changeClassSchedule: vi.fn(),
  deleteClassSchedule: vi.fn(),
  getScheduleTeachers: vi.fn(),
  readClassConfiguration: vi.fn(),
}));
vi.mock('../_actions/classActions', () => actions);
import { ClassConfigurationEditor } from './ClassConfigurationEditor';
import { ClassEditModal } from './ClassEditModal';
import type { ClassEntity, ClassSchedule } from '../_lib/schema';
const teacher = 'f231dcfe-a8d2-4b2a-b682-43fe0fbb7022';
const category = {
  id: '45d23060-7256-450a-9a6a-678f6fef8949',
  tenant_id: 'tenant',
  name: 'Math',
  created_at: '',
};
const record: ClassEntity = {
  id: '9b9ee145-f561-4acb-b231-6d22d076369c',
  tenant_id: 'tenant',
  category_id: category.id,
  name: 'Algebra',
  price: 150000,
  type: 'group',
  is_published: true,
  enrollment_status: 'closed',
  teacher_ids: [teacher],
  description: 'Summary',
  created_at: '',
};
const slot: ClassSchedule = {
  id: 'd7f235dc-f64f-473c-80cb-e98b4f630d98',
  class_id: record.id,
  day_of_week: 1,
  start_time: '09:00:00',
  end_time: '10:00:00',
  capacity: 10,
  location: 'Room A',
  tutor_id: teacher,
};
const permissions = [
  'class:update',
  'category:create',
  'schedule:create',
  'schedule:update',
  'schedule:delete',
];
beforeEach(() => {
  vi.resetAllMocks();
  actions.getScheduleTeachers.mockResolvedValue({
    state: 'ok',
    teachers: [{ id: teacher, name: 'Teacher One' }],
  });
  actions.readClassConfiguration.mockResolvedValue({
    success: true,
    message: 'Reloaded',
    data: { class: record, categories: [category], schedules: [slot] },
  });
  actions.changeClassSchedule.mockResolvedValue({
    success: true,
    message: 'Schedule saved.',
  });
  actions.deleteClassSchedule.mockResolvedValue({
    success: true,
    message: 'Schedule deleted.',
  });
  actions.createSchedule.mockResolvedValue({
    success: true,
    message: 'Schedules saved.',
  });
  actions.updateClass.mockResolvedValue({
    success: true,
    message: 'Class saved.',
    data: record,
  });
});
afterEach(cleanup);
function editor(value = record, slots = [slot], perms = permissions) {
  return render(
    <ClassConfigurationEditor
      classRecord={value}
      categories={[category]}
      schedules={slots}
      permissions={perms}
    />,
  );
}
it('preloads all mutable class and schedule fields, with read-only type', async () => {
  editor();
  await screen.findAllByRole('option', { name: 'Teacher One' });
  expect(
    (screen.getByLabelText('Class Type') as HTMLInputElement).readOnly,
  ).toBe(true);
  expect((screen.getByLabelText('Class Name') as HTMLInputElement).value).toBe(
    'Algebra',
  );
  expect(
    (screen.getByLabelText('Enrollment Status') as HTMLSelectElement).value,
  ).toBe('closed');
  expect(
    (screen.getByLabelText('Published in public catalog') as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    (
      within(
        screen
          .getByRole('button', { name: 'Save Schedule Change' })
          .closest('section')!,
      ).getByLabelText('Capacity') as HTMLInputElement
    ).value,
  ).toBe('10');
  expect(
    (
      within(
        screen
          .getByRole('button', { name: 'Save Schedule Change' })
          .closest('section')!,
      ).getByLabelText('Location') as HTMLInputElement
    ).value,
  ).toBe('Room A');
  expect(
    (screen.getByLabelText('Schedule Teacher') as HTMLSelectElement).value,
  ).toBe(teacher);
  expect((screen.getByLabelText('Start time') as HTMLInputElement).value).toBe(
    '09:00:00',
  );
});
it('creates a category with class fields then re-reads saved values and supports reopen', async () => {
  const view = editor();
  await screen.findAllByRole('option', { name: 'Teacher One' });
  fireEvent.change(screen.getByLabelText('Class Name'), {
    target: { value: 'Geometry' },
  });
  fireEvent.click(
    screen.getByLabelText('Create a new category for this class'),
  );
  fireEvent.change(screen.getByLabelText('New Category Name'), {
    target: { value: 'New category' },
  });
  fireEvent.change(screen.getByLabelText('New Category Description'), {
    target: { value: 'New detail' },
  });
  const saved = {
    ...record,
    name: 'Geometry',
    category_id: 'new-category',
    price: 160000,
  };
  actions.readClassConfiguration.mockResolvedValue({
    success: true,
    data: {
      class: saved,
      categories: [
        category,
        { ...category, id: 'new-category', name: 'New category' },
      ],
      schedules: [slot],
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(actions.updateClass).toHaveBeenCalledTimes(1));
  const form = actions.updateClass.mock.calls[0][1] as FormData;
  expect(form.get('new_category')).toBe('true');
  expect(form.get('category_name')).toBe('New category');
  expect(form.get('is_published')).toBe('true');
  await waitFor(() =>
    expect((screen.getByLabelText('Price') as HTMLInputElement).value).toBe(
      '160000',
    ),
  );
  expect(actions.readClassConfiguration).toHaveBeenCalledWith(record.id);
  view.unmount();
  editor(saved);
  expect((screen.getByLabelText('Class Name') as HTMLInputElement).value).toBe(
    'Geometry',
  );
});
it('keeps partial failures honest and reloads actual configuration after schedule refusal', async () => {
  actions.changeClassSchedule.mockResolvedValue({
    success: false,
    message: 'Capacity below reserved seats.',
  });
  editor();
  fireEvent.change(
    within(
      screen
        .getByRole('button', { name: 'Save Schedule Change' })
        .closest('section')!,
    ).getByLabelText('Capacity'),
    { target: { value: '1' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save Schedule Change' }));
  await waitFor(() =>
    expect(actions.changeClassSchedule).toHaveBeenCalledTimes(1),
  );
  expect(actions.changeClassSchedule.mock.calls[0][1]).toMatchObject({
    capacity: 1,
    location: 'Room A',
    tutor_id: teacher,
  });
  await waitFor(() =>
    expect(actions.readClassConfiguration).toHaveBeenCalledWith(record.id),
  );
  expect(screen.getByRole('alert').textContent).toContain('Capacity below');
  expect(screen.queryByText('Schedule saved.')).toBeNull();
});
it('requires confirmation to delete and removes the saved schedule after reload', async () => {
  editor();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Schedule' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Delete' }));
  expect(actions.deleteClassSchedule).not.toHaveBeenCalled();
  actions.readClassConfiguration.mockResolvedValue({
    success: true,
    data: { class: record, categories: [category], schedules: [] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Delete Schedule' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm Delete Schedule' }),
  );
  await screen.findByText('No schedules configured yet.');
  expect(actions.deleteClassSchedule).toHaveBeenCalledWith(slot.id);
  expect(screen.getByText('Add Group Schedules')).toBeTruthy();
});
it('blocks another mutation if saved-state reload is unavailable', async () => {
  actions.readClassConfiguration.mockResolvedValue({
    success: false,
    message: 'Saved state unavailable.',
  });
  editor();
  fireEvent.click(screen.getByRole('button', { name: 'Save Schedule Change' }));
  await screen.findByRole('alert');
  expect(
    screen.getByRole('button', { name: 'Save Changes' }).matches(':disabled'),
  ).toBe(true);
  expect(
    screen
      .getByRole('button', { name: 'Reload Saved Configuration' })
      .matches(':disabled'),
  ).toBe(false);
});
it('private editor has no group schedule controls and permissions restrict every operation', () => {
  const view = editor({ ...record, type: 'private' });
  expect(screen.queryByText('Group Schedules')).toBeNull();
  expect(screen.queryByText('Add Group Schedules')).toBeNull();
  expect(screen.getAllByText(/Private schedules/).length).toBeGreaterThan(0);
  view.unmount();
  editor(record, [slot], ['schedule:update']);
  expect(
    screen.getByRole('button', { name: 'Save Changes' }).matches(':disabled'),
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Delete Schedule' })).toBeNull();
  expect(screen.queryByText('Add Group Schedules')).toBeNull();
  expect(
    screen.queryByLabelText('Create a new category for this class'),
  ).toBeNull();
});

it('blocks editing when initial configuration read fails and retries the complete read', async () => {
  actions.readClassConfiguration.mockResolvedValueOnce({
    success: false,
    message: 'Saved read denied.',
  });
  render(
    <ClassEditModal
      classRecord={record}
      categories={[category]}
      permissions={permissions}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Edit Algebra/ }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Saved read denied.',
  );
  expect(screen.queryByLabelText('Class Name')).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Retry Loading Configuration' }),
  );
  await screen.findByLabelText('Class Name');
  expect(actions.readClassConfiguration).toHaveBeenCalledTimes(2);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('rereads stored details after an uncertain class save without showing success', async () => {
  actions.updateClass.mockResolvedValue({
    success: false,
    message: 'Save could not be confirmed.',
  });
  editor();
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await screen.findByText('Save could not be confirmed.');
  await waitFor(() =>
    expect(actions.readClassConfiguration).toHaveBeenCalledWith(record.id),
  );
  expect(screen.getByText(/Saved class:/).textContent).toContain('Algebra');
  expect(screen.queryByText('Class details saved.')).toBeNull();
});

it('links invalid saved schedule fields to their errors without making a request', async () => {
  render(
    <ClassConfigurationEditor
      classRecord={record}
      categories={[category]}
      schedules={[slot]}
      permissions={permissions}
    />,
  );
  fireEvent.change(screen.getByLabelText('End time'), {
    target: { value: '08:00:00' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save Schedule Change' }));
  const control = screen.getByLabelText(/^End time/);
  expect(control.getAttribute('aria-invalid')).toBe('true');
  expect(
    document.getElementById(control.getAttribute('aria-describedby')!)
      ?.textContent,
  ).toBeTruthy();
  expect(actions.changeClassSchedule).not.toHaveBeenCalled();
});
