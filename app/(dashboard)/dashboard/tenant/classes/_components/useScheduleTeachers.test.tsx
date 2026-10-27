// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { ScheduleTeachersProvider, useScheduleTeachers } from './useScheduleTeachers';
import { TeacherLoadStatus } from './TeacherLoadStatus';
import { getScheduleTeachers } from '../_actions/classActions';
import type { ScheduleTeachersRead } from '../_lib/teachers';
vi.mock('../_actions/classActions', () => ({ getScheduleTeachers: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
function Form() {
  const { read, loading, retry } = useScheduleTeachers();
  return (
    <TeacherLoadStatus
      read={read}
      loading={loading}
      retry={() => {
        retry();
        retry();
      }}
    />
  );
}
function deferred() {
  let resolve!: (value: ScheduleTeachersRead) => void;
  const promise = new Promise<ScheduleTeachersRead>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
it('locks repeated retry synchronously, announces loading, then allows recovery after another failure', async () => {
  const pending = deferred();
  vi.mocked(getScheduleTeachers)
    .mockRejectedValueOnce(new Error('offline'))
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce({
      state: 'ok',
      teachers: [{ id: 'teacher', name: 'Teacher One' }],
    });
  render(<Form />);
  const button = await screen.findByRole('button', { name: 'Retry teachers' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(
    screen
      .getByText('Retrying teachers…')
      .parentElement?.getAttribute('aria-busy'),
  ).toBe('true');
  await act(async () => {});
  expect(getScheduleTeachers).toHaveBeenCalledTimes(2);
  await act(async () => pending.resolve({ state: 'error' }));
  expect((button as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByRole('alert').textContent).toContain(
    'Unable to load teachers',
  );
  fireEvent.click(button);
  await screen.findByText('Choose an active Teacher.');
  expect(screen.queryByRole('button', { name: 'Retry teachers' })).toBeNull();
});
it.each([{ state: 'forbidden' }, { state: 'ok', teachers: [] }] as const)(
  'does not offer network retry for %j',
  async (result) => {
    vi.mocked(getScheduleTeachers).mockResolvedValue(
      result as ScheduleTeachersRead,
    );
    render(<Form />);
    await screen.findByText(
      result.state === 'forbidden'
        ? /do not have permission/
        : /No active Teacher/,
    );
    expect(screen.queryByRole('button')).toBeNull();
  },
);
it('ignores a late request from an unmounted form', async () => {
  const old = deferred();
  vi.mocked(getScheduleTeachers)
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ state: 'forbidden' });
  const first = render(<Form />);
  await act(async () => {});
  first.unmount();
  render(<Form />);
  await screen.findByText(/do not have permission/);
  await act(async () =>
    old.resolve({ state: 'ok', teachers: [{ id: 'old', name: 'Old' }] }),
  );
  expect(screen.getByText(/do not have permission/)).toBeTruthy();
});

it('shares one loader and one pending retry across every form of an editor',async()=>{
 const retry=deferred();
 vi.mocked(getScheduleTeachers).mockResolvedValueOnce({state:'error'}).mockReturnValueOnce(retry.promise);
 render(<ScheduleTeachersProvider><Form/><Form/></ScheduleTeachersProvider>);
 const buttons=await screen.findAllByRole('button',{name:'Retry teachers'});
 expect(getScheduleTeachers).toHaveBeenCalledTimes(1);
 fireEvent.click(buttons[0]);fireEvent.click(buttons[1]);
 await act(async()=>{});
 expect(getScheduleTeachers).toHaveBeenCalledTimes(2);
 await act(async()=>retry.resolve({state:'ok',teachers:[{id:'current',name:'Current Teacher'}]}));
 expect(await screen.findAllByText('Choose an active Teacher.')).toHaveLength(2);
});
it('keeps different editor scopes independent and does not reuse a closed editor result',async()=>{
 vi.mocked(getScheduleTeachers).mockResolvedValue({state:'forbidden'});
 const first=render(<><ScheduleTeachersProvider><Form/></ScheduleTeachersProvider><ScheduleTeachersProvider><Form/></ScheduleTeachersProvider></>);
 await screen.findAllByText(/do not have permission/);expect(getScheduleTeachers).toHaveBeenCalledTimes(2);
 first.unmount();
 vi.mocked(getScheduleTeachers).mockResolvedValue({state:'ok',teachers:[{id:'new',name:'New scope'}]});
 render(<ScheduleTeachersProvider><Form/></ScheduleTeachersProvider>);
 await screen.findByText('Choose an active Teacher.');expect(getScheduleTeachers).toHaveBeenCalledTimes(3);
});
