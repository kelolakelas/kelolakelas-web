import { expect, it } from 'vitest';
import { voucherDateTimePayload, voucherLocalDateTime } from './datetime';
it('roundtrips local dates across month/year boundaries with second precision', () => {
  for (const date of ['2026-10-31', '2026-12-31', '2027-01-01'])
    for (const time of ['00:00:00', '23:59:59', '12:34:56']) {
      expect(voucherLocalDateTime(voucherDateTimePayload(date, time))).toEqual({
        date,
        time,
      });
    }
});
it('uses the actual process timezone rather than slicing the UTC calendar date', () => {
  const actual = voucherLocalDateTime('2026-12-31T21:23:45Z');
  if (process.env.TZ === 'Asia/Jakarta')
    expect(actual).toEqual({ date: '2027-01-01', time: '04:23:45' });
  else if (process.env.TZ === 'UTC')
    expect(actual).toEqual({ date: '2026-12-31', time: '21:23:45' });
  else expect(actual.time.endsWith(':45')).toBe(true);
});
it('keeps empty/invalid data safe and incomplete dates invalid', () => {
  expect(voucherLocalDateTime(null)).toEqual({ date: '', time: '' });
  expect(voucherLocalDateTime('invalid')).toEqual({ date: '', time: '' });
  expect(voucherDateTimePayload('', '')).toBe('');
  expect(voucherDateTimePayload('2026-10-16', '')).toBe('2026-10-16T');
});
