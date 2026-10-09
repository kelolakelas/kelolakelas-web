import { describe, expect, it } from 'vitest';
import { findOverlappingSlotPairs } from './schema';

/**
 * Unit tests for the same-day overlap detector (KEL-176).
 *
 * `findOverlappingSlotPairs` is the pure function behind the advisory
 * overlap warnings in `ScheduleForm`: two slots overlap when they share a
 * day and their half-open intervals intersect. Slots that only touch at a
 * boundary, live on different days, or still carry half-typed times are
 * never flagged.
 */

describe('findOverlappingSlotPairs', () => {
  it('flags two Monday slots whose intervals intersect', () => {
    expect(
      findOverlappingSlotPairs([
        { day_of_week: 1, start_time: '08:00', end_time: '09:30' },
        { day_of_week: 1, start_time: '09:00', end_time: '10:30' },
      ])
    ).toEqual([{ first: 0, second: 1 }]);
  });

  it('does not flag slots that only touch at the boundary', () => {
    expect(
      findOverlappingSlotPairs([
        { day_of_week: 1, start_time: '08:00', end_time: '09:30' },
        { day_of_week: 1, start_time: '09:30', end_time: '11:00' },
      ])
    ).toEqual([]);
  });

  it('ignores slots on different days with identical hours', () => {
    expect(
      findOverlappingSlotPairs([
        { day_of_week: 1, start_time: '08:00', end_time: '09:30' },
        { day_of_week: 2, start_time: '08:00', end_time: '09:30' },
      ])
    ).toEqual([]);
  });

  it('skips pairs with half-typed or malformed times instead of throwing', () => {
    expect(
      findOverlappingSlotPairs([
        { day_of_week: 1, start_time: '08:00', end_time: '09:30' },
        { day_of_week: 1, start_time: '', end_time: '10:30' },
        { day_of_week: 1, start_time: '09:00', end_time: 'not-a-time' },
      ])
    ).toEqual([]);
  });

  it('skips degenerate intervals whose end is not after their start', () => {
    expect(
      findOverlappingSlotPairs([
        { day_of_week: 1, start_time: '09:30', end_time: '09:30' },
        { day_of_week: 1, start_time: '11:00', end_time: '09:00' },
        { day_of_week: 1, start_time: '08:00', end_time: '12:00' },
      ])
    ).toEqual([]);
  });

  it('supports HH:MM:SS bounds the same way as HH:MM', () => {
    expect(
      findOverlappingSlotPairs([
        { day_of_week: 1, start_time: '08:00:00', end_time: '09:30:00' },
        { day_of_week: 1, start_time: '09:00', end_time: '10:30' },
      ])
    ).toEqual([{ first: 0, second: 1 }]);
  });

  it('flags every overlapping pair among three mutually overlapping slots', () => {
    expect(
      findOverlappingSlotPairs([
        { day_of_week: 1, start_time: '08:00', end_time: '10:00' },
        { day_of_week: 1, start_time: '09:00', end_time: '11:00' },
        { day_of_week: 1, start_time: '09:30', end_time: '12:00' },
      ])
    ).toEqual([
      { first: 0, second: 1 },
      { first: 0, second: 2 },
      { first: 1, second: 2 },
    ]);
  });

  it('returns no pairs for an empty or single-slot list', () => {
    expect(findOverlappingSlotPairs([])).toEqual([]);
    expect(
      findOverlappingSlotPairs([
        { day_of_week: 1, start_time: '08:00', end_time: '09:30' },
      ])
    ).toEqual([]);
  });
});
