import { describe, expect, it } from 'vitest';
import { calendarDateError, joinCalendarDate, pastedCalendarDate, splitCalendarDate } from './calendar-date';
describe('calendar-only serialization', () => {
  it.each(['0001-01-01', '1900-02-28', '2000-02-29', '2024-02-29', '2026-12-31', '9999-12-31'])('roundtrips %s without timezone conversion', value => {
    expect(joinCalendarDate(splitCalendarDate(value))).toBe(value);
  });
  it.each([['29', '02', '1900'], ['29', '02', '2026'], ['31', '04', '2026'], ['00', '01', '2026'], ['01', '13', '2026'], ['1', '', '2026'], ['1', '1', '0000']])('rejects impossible/partial date %j', (day, month, year) => {
    expect(joinCalendarDate([day, month, year])).toBe('');
  });
  it('supports Indonesian and ISO paste while rejecting invalid/ambiguous formats', () => {
    expect(joinCalendarDate(pastedCalendarDate('3/2/2018')!)).toBe('2018-02-03');
    expect(joinCalendarDate(pastedCalendarDate('2018-02-03')!)).toBe('2018-02-03');
    expect(joinCalendarDate(pastedCalendarDate('29/02/2026')!)).toBe('');
    expect(pastedCalendarDate('October 1, 2026')).toBeNull();
  });
  it('enforces required, real dates and inclusive calendar bounds', () => {
    expect(calendarDateError(['', '', ''], false)).toBe('');
    expect(calendarDateError(['', '', ''], true)).toContain('wajib');
    expect(calendarDateError(['01', '01', '2026'], true, '2026-01-01', '2026-01-01')).toBe('');
    expect(calendarDateError(['31', '12', '2025'], false, '2026-01-01')).toContain('paling awal');
    expect(calendarDateError(['02', '01', '2026'], false, undefined, '2026-01-01')).toContain('paling akhir');
  });
});
