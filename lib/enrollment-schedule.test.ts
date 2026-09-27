import { describe, expect, it } from 'vitest';
import { enrollmentScheduleLabel, SCHEDULE_UNAVAILABLE_LABEL } from './enrollment-schedule';

const SCHEDULE_ID = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';

describe('enrollmentScheduleLabel (KEL-70)', () => {
  it.each([
    [1, 'Senin'],
    [2, 'Selasa'],
    [3, 'Rabu'],
    [4, 'Kamis'],
    [5, 'Jumat'],
    [6, 'Sabtu'],
    [7, 'Minggu'],
  ])('names ISO day %i in Indonesian as %s', (day, name) => {
    expect(enrollmentScheduleLabel({ schedule_id: SCHEDULE_ID, schedule: { day_of_week: day, start_time: '16:00:00', end_time: '17:30:00' } })).toBe(`${name}, 16:00–17:30`);
  });

  it('appends a trimmed location when present', () => {
    expect(enrollmentScheduleLabel({ schedule_id: SCHEDULE_ID, schedule: { day_of_week: 1, start_time: '16:00:00', end_time: '17:30:00', location: '  Ruang A ' } })).toBe('Senin, 16:00–17:30 · Ruang A');
  });

  it.each([undefined, null, '', '   '])('omits an empty location (%j)', (location) => {
    expect(enrollmentScheduleLabel({ schedule_id: SCHEDULE_ID, schedule: { day_of_week: 3, start_time: '09:00:00', end_time: '10:00:00', location } })).toBe('Rabu, 09:00–10:00');
  });

  it('shows no schedule row for a private enrollment without schedule_id', () => {
    expect(enrollmentScheduleLabel({})).toBeNull();
    expect(enrollmentScheduleLabel({ schedule_id: null, schedule: null })).toBeNull();
  });

  it('labels a schedule that no longer exists as unavailable', () => {
    // A deleted schedule keeps schedule_id but the backend omits the summary; an
    // older backend without the field looks the same.
    expect(enrollmentScheduleLabel({ schedule_id: SCHEDULE_ID })).toBe(SCHEDULE_UNAVAILABLE_LABEL);
    expect(enrollmentScheduleLabel({ schedule_id: SCHEDULE_ID, schedule: null })).toBe(SCHEDULE_UNAVAILABLE_LABEL);
  });

  it.each([
    { day_of_week: 0, start_time: '10:00:00', end_time: '11:00:00' },
    { day_of_week: 8, start_time: '10:00:00', end_time: '11:00:00' },
    { day_of_week: 1.5, start_time: '10:00:00', end_time: '11:00:00' },
    { day_of_week: null, start_time: '10:00:00', end_time: '11:00:00' },
    { day_of_week: 1, start_time: '', end_time: '11:00:00' },
    { day_of_week: 1, start_time: '10:00:00', end_time: null },
  ])('never renders a malformed summary %j', (schedule) => {
    expect(enrollmentScheduleLabel({ schedule_id: SCHEDULE_ID, schedule })).toBe(SCHEDULE_UNAVAILABLE_LABEL);
  });
});
