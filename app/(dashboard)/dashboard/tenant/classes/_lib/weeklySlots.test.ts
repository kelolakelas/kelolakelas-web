import { describe, expect, it } from 'vitest';
import {
  generateWeeklySlots,
  weeklySlotGeneratorSchema,
  type WeeklySlotGeneratorInput,
} from './schema';

/**
 * Unit tests for the weekly slot generator (KEL-112).
 *
 * `generateWeeklySlots` is the pure function behind the generator section of
 * `ScheduleForm`: given checked days, a wall-clock window, a session length,
 * and a break, it produces the back-to-back sessions that fit. Sessions that
 * would end past the window end are skipped; an invalid input yields no slots
 * instead of throwing, because the form validates first and reports a
 * per-field message.
 */

const baseInput: WeeklySlotGeneratorInput = {
  days: [1, 3],
  start_time: '08:00',
  end_time: '12:00',
  session_minutes: 90,
  break_minutes: 15,
  capacity: 10,
  location: 'Room 101',
};

describe('generateWeeklySlots contract example', () => {
  it('produces exactly two slots per checked day for 08:00-12:00 / 90 / 15', () => {
    const slots = generateWeeklySlots(baseInput);

    expect(slots).toEqual([
      {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '09:30',
        capacity: 10,
        location: 'Room 101',
      },
      {
        day_of_week: 1,
        start_time: '09:45',
        end_time: '11:15',
        capacity: 10,
        location: 'Room 101',
      },
      {
        day_of_week: 3,
        start_time: '08:00',
        end_time: '09:30',
        capacity: 10,
        location: 'Room 101',
      },
      {
        day_of_week: 3,
        start_time: '09:45',
        end_time: '11:15',
        capacity: 10,
        location: 'Room 101',
      },
    ]);
  });
});

describe('generateWeeklySlots boundaries', () => {
  it('keeps a session that ends exactly on the window end', () => {
    const slots = generateWeeklySlots({
      ...baseInput,
      days: [2],
      start_time: '08:00',
      end_time: '09:30',
    });

    expect(slots).toEqual([
      {
        day_of_week: 2,
        start_time: '08:00',
        end_time: '09:30',
        capacity: 10,
        location: 'Room 101',
      },
    ]);
  });

  it('runs back-to-back sessions when the break is 0', () => {
    const slots = generateWeeklySlots({
      ...baseInput,
      days: [5],
      start_time: '08:00',
      end_time: '10:00',
      session_minutes: 60,
      break_minutes: 0,
    });

    expect(slots.map((slot) => [slot.start_time, slot.end_time])).toEqual([
      ['08:00', '09:00'],
      ['09:00', '10:00'],
    ]);
  });

  it('yields no slots when the session is longer than the window', () => {
    expect(
      generateWeeklySlots({
        ...baseInput,
        start_time: '08:00',
        end_time: '09:00',
        session_minutes: 90,
      })
    ).toEqual([]);
  });

  it('yields no slots for an overnight window, which is unsupported', () => {
    expect(
      generateWeeklySlots({
        ...baseInput,
        start_time: '22:00',
        end_time: '06:00',
      })
    ).toEqual([]);
  });

  it('yields no slots for degenerate inputs instead of throwing', () => {
    expect(generateWeeklySlots({ ...baseInput, days: [] })).toEqual([]);
    expect(
      generateWeeklySlots({ ...baseInput, session_minutes: 0 })
    ).toEqual([]);
    expect(generateWeeklySlots({ ...baseInput, break_minutes: -5 })).toEqual(
      []
    );
    expect(
      generateWeeklySlots({
        ...baseInput,
        start_time: 'not-a-time',
      } as unknown as WeeklySlotGeneratorInput)
    ).toEqual([]);
  });

  it('de-duplicates and sorts the checked days', () => {
    const slots = generateWeeklySlots({
      ...baseInput,
      days: [3, 1, 3, 1],
      start_time: '08:00',
      end_time: '09:30',
    });

    expect(slots.map((slot) => slot.day_of_week)).toEqual([1, 3]);
  });

  it('carries capacity and the trimmed location onto every slot', () => {
    const slots = generateWeeklySlots({
      ...baseInput,
      days: [4],
      capacity: 25,
      location: '  Zoom Room  ',
    });

    expect(slots.length).toBe(2);
    for (const slot of slots) {
      expect(slot.capacity).toBe(25);
      expect(slot.location).toBe('Zoom Room');
    }
  });

  it('omits the location when it is blank', () => {
    const slots = generateWeeklySlots({
      ...baseInput,
      days: [4],
      location: '   ',
    });

    expect(slots.length).toBe(2);
    for (const slot of slots) {
      expect('location' in slot).toBe(false);
    }
  });
});

describe('weeklySlotGeneratorSchema validation', () => {
  it('accepts the contract example and coerces numeric strings', () => {
    const result = weeklySlotGeneratorSchema.safeParse({
      days: [1, 3],
      start_time: '08:00',
      end_time: '12:00',
      session_minutes: '90',
      break_minutes: '15',
      capacity: '10',
      location: 'Room 101',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.session_minutes).toBe(90);
      expect(result.data.break_minutes).toBe(15);
      expect(result.data.capacity).toBe(10);
    }
  });

  it('rejects an empty day selection', () => {
    const result = weeklySlotGeneratorSchema.safeParse({
      ...baseInput,
      days: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.days?.[0]).toBe(
        'Select at least one day'
      );
    }
  });

  it('rejects a non-positive session length', () => {
    for (const session_minutes of [0, -30]) {
      const result = weeklySlotGeneratorSchema.safeParse({
        ...baseInput,
        session_minutes,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.flatten().fieldErrors.session_minutes?.[0]
        ).toBe('Session length must be greater than 0');
      }
    }
  });

  it('rejects a negative break', () => {
    const result = weeklySlotGeneratorSchema.safeParse({
      ...baseInput,
      break_minutes: -5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.break_minutes?.[0]).toBe(
        'Break cannot be negative'
      );
    }
  });

  it('rejects an end time that is not after the start time', () => {
    const result = weeklySlotGeneratorSchema.safeParse({
      ...baseInput,
      start_time: '12:00',
      end_time: '08:00',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.end_time?.[0]).toBe(
        'End time must be strictly after start time'
      );
    }
  });

  it('rejects an invalid capacity with the per-slot capacity message', () => {
    const result = weeklySlotGeneratorSchema.safeParse({
      ...baseInput,
      capacity: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.capacity?.[0]).toBe(
        'Capacity must be at least 1'
      );
    }
  });

  it('rejects a malformed time with a per-field message', () => {
    const result = weeklySlotGeneratorSchema.safeParse({
      ...baseInput,
      start_time: '8 pagi',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.start_time?.[0]).toBe(
        'Start time must be in HH:MM format'
      );
    }
  });
});
