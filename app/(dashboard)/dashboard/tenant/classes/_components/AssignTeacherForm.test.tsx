// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AssignTeacherForm } from './AssignTeacherForm';
const { read, assign } = vi.hoisted(() => ({ read: vi.fn(), assign: vi.fn() }));
vi.mock('../_actions/classActions', () => ({ getScheduleTeachers: read, assignScheduleTeacher: assign }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const schedule = { id: 'schedule', class_id: 'class', enrollment_id: 'enrollment', day_of_week: 5, start_time: '09:00:00', end_time: '10:00:00' };
it('shows unassigned, loads active member options, keeps assignment failure visible', async () => {
  read.mockResolvedValue({ state: 'ok', teachers: [{ id: 'member-not-user', name: 'Teacher One' }] });
  assign.mockResolvedValue({ success: false, message: 'Membership unavailable' });
  render(<AssignTeacherForm schedule={schedule} />);
  expect(screen.getByText('Belum ditugaskan')).toBeTruthy();
  fireEvent.click(screen.getByText('Tugaskan teacher'));
  await screen.findByText('Teacher One');
  fireEvent.change(screen.getByLabelText('Teacher aktif'), { target: { value: 'member-not-user' } });
  fireEvent.change(screen.getByLabelText('Mulai tanggal'), { target: { value: '2026-10-14' } });
  fireEvent.click(screen.getByText('Simpan penugasan'));
  await waitFor(() => expect(assign).toHaveBeenCalledWith('schedule', 'member-not-user', '2026-10-14'));
  expect(await screen.findByText('Membership unavailable')).toBeTruthy();
  expect(screen.getByLabelText('Teacher aktif')).toBeTruthy();
});
it.each(['forbidden', 'error'])('does not offer assignment on %s', async (state) => {
  read.mockResolvedValue({ state });
  render(<AssignTeacherForm schedule={schedule} />);
  fireEvent.click(screen.getByText('Tugaskan teacher'));
  await screen.findByRole('alert');
  expect(screen.queryByText('Simpan penugasan')).toBeNull();
});
