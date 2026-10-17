// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
const actions = vi.hoisted(() => ({
  createClassConfiguration: vi.fn(),
  createCategory: vi.fn(),
  createClass: vi.fn(),
  createSchedule: vi.fn(),
  getScheduleTeachers: vi.fn(),
}));
vi.mock('../_actions/classActions', () => actions);
import { ClassCreationWizard } from './ClassCreationWizard';
import { CategoryForm } from './CategoryForm';
const teacher = 'f231dcfe-a8d2-4b2a-b682-43fe0fbb7022';
const existing = {
  id: '45d23060-7256-450a-9a6a-678f6fef8949',
  tenant_id: 'tenant',
  name: 'Existing',
  created_at: '',
};
beforeEach(() => {
  vi.resetAllMocks();
  actions.getScheduleTeachers.mockResolvedValue({
    state: 'ok',
    teachers: [{ id: teacher, name: 'Teacher One' }],
  });
  actions.createClassConfiguration.mockResolvedValue({
    success: true,
    message: 'Complete class saved.',
  });
});
afterEach(cleanup);
const open = () => {
  render(<ClassCreationWizard existingCategories={[existing]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Create New Class' }));
};
const category = () => {
  fireEvent.change(screen.getByLabelText(/^Category Name/), {
    target: { value: 'Draft category' },
  });
  fireEvent.change(screen.getByLabelText(/^Description/), {
    target: { value: 'Category detail' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create Category' }));
};
async function details(privateClass = false) {
  fireEvent.change(screen.getByLabelText(/^Class \/ Course Name/), {
    target: { value: 'Draft class' },
  });
  fireEvent.change(screen.getByLabelText(/^Price/), {
    target: { value: '150000' },
  });
  fireEvent.change(screen.getByLabelText(/^Class Summary/), {
    target: { value: 'Class detail' },
  });
  if (privateClass)
    fireEvent.click(screen.getByRole('button', { name: /Private 1-on-1/ }));
  fireEvent.click(screen.getByRole('button', { name: /Next: Review/ }));
  await screen.findAllByRole('option', { name: 'Teacher One' });
  if (!privateClass) fireEvent.click(screen.getByRole('button', {name:'Add Slot'}));
  fireEvent.change(screen.getByLabelText(privateClass ? 'Assigned Teacher' : 'Teacher for all slots'), {target: {value: teacher}});
}
const noMutations = () => {
  for (const key of [
    'createClassConfiguration',
    'createCategory',
    'createClass',
    'createSchedule',
  ] as const)
    expect(actions[key]).not.toHaveBeenCalled();
};
describe('local class creation draft', () => {
  it('advances category without persistence and retains inputs/slots across Back and Next', async () => {
    open();
    category();
    expect(screen.getByRole('dialog')).toBeTruthy();
    noMutations();
    await details();
    fireEvent.click(screen.getByRole('button', { name: /Add Slot/ }));
    const slots = () =>
      document.querySelectorAll('[name="schedules"]')[0] as HTMLInputElement;
    const snapshot = slots().value;
    fireEvent.click(screen.getByRole('button', { name: /← Back/ }));
    expect(
      (screen.getByLabelText(/^Class \/ Course Name/) as HTMLInputElement)
        .value,
    ).toBe('Draft class');
    expect(
      (screen.getByLabelText('Teacher for all slots') as HTMLSelectElement).value,
    ).toBe(teacher);
    fireEvent.click(screen.getByRole('button', { name: 'Change Category' }));
    expect(
      (screen.getByLabelText(/^Category Name/) as HTMLInputElement).value,
    ).toBe('Draft category');
    fireEvent.click(screen.getByRole('button', { name: /Existing.*Select/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next: Review/ }));
    expect(slots().value).toBe(snapshot);
    noMutations();
    fireEvent.click(
      screen.getByRole('button', { name: /Save Complete Class/ }),
    );
    await waitFor(() =>
      expect(actions.createClassConfiguration).toHaveBeenCalledTimes(1),
    );
    expect(actions.createClassConfiguration.mock.calls[0][0]).toMatchObject({
      category_id: existing.id,
      class: { name: 'Draft class', price: 150000 },
      teacher_ids: [teacher],
    });
    expect(
      actions.createClassConfiguration.mock.calls[0][0].schedules,
    ).toHaveLength(2);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe(
      'Complete class saved.',
    );
  });
  it.each([1, 2, 3])(
    'close at step %s discards draft with no writes and restores trigger focus',
    async (step) => {
      open();
      if (step > 1) category();
      if (step > 2) await details();
      fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));
      noMutations();
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Create New Class' }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Create New Class' }));
      expect(
        (screen.getByLabelText(/^Category Name/) as HTMLInputElement).value,
      ).toBe('');
    },
  );
  it('navigation/unmount and Escape discard draft without a mutation; keyboard focus stays inside', async () => {
    const view = render(<ClassCreationWizard existingCategories={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create New Class' }));
    category();
    await details();
    view.unmount();
    noMutations();
    open();
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close modal' });
    const last = screen.getByRole('button', { name: 'Create Category' });
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    noMutations();
  });
  it('saves private configuration once with no schedules and prevents double submit', async () => {
    let resolve!: (value: unknown) => void;
    actions.createClassConfiguration.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    open();
    category();
    await details(true);
    fireEvent.click(
      screen.getByRole('button', { name: /Save Complete Class/ }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Save Complete Class/ }),
    );
    expect(actions.createClassConfiguration).toHaveBeenCalledTimes(1);
    expect(actions.createClassConfiguration.mock.calls[0][0]).toMatchObject({
      category: { name: 'Draft category', description: 'Category detail' },
      class: { type: 'private' },
      teacher_ids: [teacher],
      schedules: [],
    });
    expect(
      (screen.getByRole('button', { name: 'Close modal' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    resolve({ success: true, message: 'Private saved.' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('retains editable draft after definite rejection and original key/payload after unknown result', async () => {
    actions.createClassConfiguration
      .mockResolvedValueOnce({ success: false, message: 'Permission denied.' })
      .mockResolvedValueOnce({
        success: false,
        message: 'Result unknown.',
        retrySameRequest: true,
      })
      .mockResolvedValueOnce({ success: false, message: 'Permission changed.' })
      .mockResolvedValueOnce({ success: true, message: 'Recovered.' });
    open();
    category();
    await details();
    fireEvent.click(
      screen.getByRole('button', { name: /Save Complete Class/ }),
    );
    const alert = await screen.findByText('Permission denied.');
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.closest('fieldset')).toBeNull();
    fireEvent.keyDown(alert, {key: 'Tab'});
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Close modal'}));
    fireEvent.click(screen.getByRole('button', { name: /← Back/ }));
    expect(
      (screen.getByLabelText(/^Class \/ Course Name/) as HTMLInputElement)
        .value,
    ).toBe('Draft class');
    fireEvent.click(screen.getByRole('button', { name: /Next: Review/ }));
    fireEvent.click(
      screen.getByRole('button', { name: /Save Complete Class/ }),
    );
    await screen.findByText('Result unknown.');
    const original = actions.createClassConfiguration.mock.calls[1];
    expect(
      screen.getByRole('button', { name: /← Back/ }).matches(':disabled'),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry Same Request' }));
    await waitFor(() =>
      expect(actions.createClassConfiguration).toHaveBeenCalledTimes(3),
    );
    expect(actions.createClassConfiguration.mock.calls[2]).toEqual(original);
    await screen.findByText('Permission changed.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry Same Request' }));
    await waitFor(() => expect(actions.createClassConfiguration).toHaveBeenCalledTimes(4));
    expect(actions.createClassConfiguration.mock.calls[3]).toEqual(original);
    await screen.findByText('Recovered.');
  });
  it('keeps generator, overlap guidance and the slot teacher picker in the final draft', async () => {
    open(); category(); await details();
    fireEvent.change(screen.getByLabelText('Day of Week'), {target:{value:'1'}});
    fireEvent.change(screen.getAllByLabelText('Start Time', {selector:'input'}).at(-1)!, {target:{value:'09:00'}});
    fireEvent.change(screen.getAllByLabelText('End Time', {selector:'input'}).at(-1)!, {target:{value:'10:30'}});
    fireEvent.click(screen.getByRole('button', { name: 'Generate Slots' }));
    expect(screen.getByRole('status').textContent).toContain('Added');
    expect(screen.getAllByRole('alert').some(alert => alert.textContent?.includes('overlap'))).toBe(true);
    fireEvent.change(screen.getByLabelText('Teacher for all slots'), {target:{value:teacher}});
    noMutations();
    fireEvent.click(screen.getByRole('button', {name:/Save Complete Class/}));
    await waitFor(() => expect(actions.createClassConfiguration).toHaveBeenCalledTimes(1));
    const payload = actions.createClassConfiguration.mock.calls[0][0];
    expect(payload.schedules.length).toBeGreaterThan(1);
    expect(payload.schedules.every((slot: {tutor_id:string}) => slot.tutor_id === teacher)).toBe(true);
  });

  it('keeps standalone category creation as an actual mutation', async () => {
    const selected = vi.fn();
    actions.createCategory.mockResolvedValue({
      success: true,
      data: existing,
      message: 'Created.',
    });
    render(
      <CategoryForm existingCategories={[]} onSelectCategory={selected} />,
    );
    fireEvent.change(screen.getByLabelText(/^Category Name/), {
      target: { value: 'Standalone' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Category' }));
    await waitFor(() =>
      expect(actions.createCategory).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(selected).toHaveBeenCalledWith(existing));
  });
});

it('keeps the original draft/key after an interrupted action and rejects duplicate retries while pending', async () => {
  actions.createClassConfiguration.mockRejectedValueOnce(new Error('network'));
  open(); category(); await details();
  fireEvent.click(screen.getByRole('button', {name: /Save Complete Class/}));
  const alert = await screen.findByRole('alert');
  await waitFor(() => expect(document.activeElement).toBe(alert));
  expect(alert.textContent).toContain('connection was interrupted');
  const original = actions.createClassConfiguration.mock.calls[0];
  let resolve!: (value: unknown) => void;
  actions.createClassConfiguration.mockReturnValueOnce(new Promise(r => {resolve = r;}));
  fireEvent.click(screen.getByRole('button', {name: 'Retry Same Request'}));
  fireEvent.click(screen.getByRole('button', {name: 'Checking…'}));
  expect(actions.createClassConfiguration).toHaveBeenCalledTimes(2);
  expect(actions.createClassConfiguration.mock.calls[1]).toEqual(original);
  resolve({success: false, message: 'Still unavailable.', retrySameRequest:true});
  await screen.findByText('Still unavailable.');
  expect((screen.getByLabelText(/^Class \/ Course Name/, {selector:'input'}) as HTMLInputElement).value).toBe('Draft class');
});

const teacherB = 'd2ce6ae3-6441-426b-b517-c14516aa6fca';
const teacherC = '2de113bf-c15e-43bd-97b2-c612e01ca9a2';
it('saves A/B from slots, clears stale bulk, and removes unused teachers from the payload', async () => {
  actions.getScheduleTeachers.mockResolvedValue({state:'ok', teachers:[
    {id:teacher,name:'Teacher One'}, {id:teacherB,name:'Teacher Two'}, {id:teacherC,name:'Teacher Three'}
  ]});
  open(); category(); await details();
  expect(screen.queryByLabelText('Assigned Teacher')).toBeNull();
  fireEvent.click(screen.getByRole('button', {name:'Add Slot'}));
  fireEvent.change(screen.getByLabelText('Teacher for slot 2'), {target:{value:teacherB}});
  expect((screen.getByLabelText('Teacher for all slots') as HTMLSelectElement).value).toBe('');
  expect((screen.getByLabelText('Teacher for slot 1') as HTMLSelectElement).value).toBe(teacher);
  fireEvent.click(screen.getByRole('button', {name:/Save Complete Class/}));
  await waitFor(() => expect(actions.createClassConfiguration).toHaveBeenCalledTimes(1));
  const payload = actions.createClassConfiguration.mock.calls[0][0];
  expect(payload.teacher_ids).toEqual([teacher, teacherB]);
  expect(payload.schedules.map((s:{tutor_id:string})=>s.tutor_id)).toEqual([teacher,teacherB]);
});
it('bulk C replaces overrides and applies to new/generated slots; removal drops unused B', async () => {
  actions.createClassConfiguration.mockResolvedValue({success:false,message:'Correctable error.'});
  actions.getScheduleTeachers.mockResolvedValue({state:'ok', teachers:[
    {id:teacher,name:'Teacher One'}, {id:teacherB,name:'Teacher Two'}, {id:teacherC,name:'Teacher Three'}
  ]});
  open(); category(); await details();
  fireEvent.click(screen.getByRole('button', {name:'Add Slot'}));
  fireEvent.change(screen.getByLabelText('Teacher for slot 2'), {target:{value:teacherB}});
  fireEvent.click(screen.getByLabelText('Remove slot 2'));
  fireEvent.click(screen.getByRole('button', {name:/Save Complete Class/}));
  await screen.findByText('Correctable error.');
  expect(actions.createClassConfiguration.mock.calls[0][0].teacher_ids).toEqual([teacher]);
  fireEvent.change(screen.getByLabelText('Teacher for all slots'), {target:{value:teacherC}});
  fireEvent.click(screen.getByRole('button', {name:'Generate Slots'}));
  fireEvent.click(screen.getByRole('button', {name:'Add Slot'}));
  fireEvent.click(screen.getByRole('button', {name:/Save Complete Class/}));
  await waitFor(() => expect(actions.createClassConfiguration).toHaveBeenCalledTimes(2));
  const payload=actions.createClassConfiguration.mock.calls[1][0];
  expect(payload.teacher_ids).toEqual([teacherC]);
  expect(payload.schedules.every((s:{tutor_id:string})=>s.tutor_id===teacherC)).toBe(true);
});
it('requires a teacher for every group slot before a write, and allows correcting it', async () => {
  open(); category(); await details();
  fireEvent.change(screen.getByLabelText('Teacher for slot 1'), {target:{value:''}});
  fireEvent.submit(screen.getByRole('button', {name:/Save Complete Class/}).closest('form')!);
  expect(actions.createClassConfiguration).not.toHaveBeenCalled();
  expect(screen.getByText('Select an active Teacher for every slot.')).toBeTruthy();
  expect(screen.getByLabelText('Teacher for slot 1').getAttribute('aria-invalid')).toBe('true');
  fireEvent.change(screen.getByLabelText('Teacher for slot 1'), {target:{value:teacher}});
  fireEvent.click(screen.getByRole('button', {name:/Save Complete Class/}));
  await waitFor(() => expect(actions.createClassConfiguration).toHaveBeenCalledTimes(1));
});

it('switches private to group into an empty timetable and preserves explicit slots across later type changes', async () => {
  open(); category(); await details(true);
  fireEvent.click(screen.getByRole('button', {name:/← Back/}));
  fireEvent.click(screen.getByRole('button', {name:/Group Class/}));
  fireEvent.click(screen.getByRole('button', {name:/Next: Review/}));
  expect(screen.getByText(/No timetable slots yet/)).toBeTruthy();
  expect((screen.getByRole('button',{name:/Save Complete Class/}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Add Slot'}));
  fireEvent.change(screen.getByLabelText('Teacher for all slots'),{target:{value:teacher}});
  const snapshot=(document.querySelector('[name="schedules"]') as HTMLInputElement).value;
  fireEvent.click(screen.getByRole('button',{name:/← Back/}));
  fireEvent.click(screen.getByRole('button',{name:/Private 1-on-1/}));
  fireEvent.click(screen.getByRole('button',{name:/Next: Review/}));
  fireEvent.click(screen.getByRole('button',{name:/← Back/}));
  fireEvent.click(screen.getByRole('button',{name:/Group Class/}));
  fireEvent.click(screen.getByRole('button',{name:/Next: Review/}));
  expect((document.querySelector('[name="schedules"]') as HTMLInputElement).value).toBe(snapshot);
  noMutations();
});
