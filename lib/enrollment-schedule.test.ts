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

describe('private enrollment schedules (KEL-222)', () => {
  const slots = [
    { id: 'version-old', day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00', valid_from: '2026-01-01T00:00:00Z', valid_until: '2026-10-31T00:00:00Z' },
    { id: 'version-new', day_of_week: 2, start_time: '10:00:00', end_time: '11:00:00', valid_from: '2026-11-01T00:00:00Z' },
    { id: 'second-slot', day_of_week: 4, start_time: '14:00:00', end_time: '15:00:00' },
  ];
  it('renders every version once with effective dates and stable server order', () => {
    const label = enrollmentScheduleLabel({ private_schedules: [...slots, slots[0]] });
    expect(label?.split('\n')).toHaveLength(3);
    expect(label).toContain('Selasa, 10:00–11:00 · Berlaku 1 Jan 2026–31 Okt 2026');
    expect(label).toContain('Berlaku 1 Nov 2026–seterusnya');
    expect(label?.split('\n')[2]).toBe('Kamis, 14:00–15:00');
  });
  it('distinguishes a confirmed empty collection from unavailable or malformed data', () => {
    expect(enrollmentScheduleLabel({ private_schedules: [] })).toBe('Belum ada jadwal');
    expect(enrollmentScheduleLabel({ class: { type: 'private' } })).toBe(SCHEDULE_UNAVAILABLE_LABEL);
    expect(enrollmentScheduleLabel({ private_schedules: null })).toBe(SCHEDULE_UNAVAILABLE_LABEL);
    expect(enrollmentScheduleLabel({ private_schedules: [{ ...slots[0], valid_from: 'broken' }] })).toBe(SCHEDULE_UNAVAILABLE_LABEL);
    expect(enrollmentScheduleLabel({ private_schedules: [{ ...slots[0], day_of_week: 9 }] })).toBe(SCHEDULE_UNAVAILABLE_LABEL);
  });
});
