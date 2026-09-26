import { describe, expect, it } from 'vitest';
import {
  createScheduleSchema,
  scheduleItemSchema,
  updateClassSchema,
} from './schema';

/**
 * These cases pin the update contract to the academic service endpoint
 * (`PATCH /api/v1/classes/:id`). The schema is the only place the browser-side
 * shape is decided, so a regression here would either block a legitimate edit
 * or forward a field the backend refuses to change.
 */

const validPayload = {
  class_id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11',
  category_id: '8d2c7e10-9f3b-4a5c-b6d7-1e2f3a4b5c6d',
  name: 'Matematika Dasar',
  price: 150000,
  description: 'Kelas pengantar matematika.',
};

describe('updateClassSchema', () => {
  it('accepts the editable fields and keeps the numeric price', () => {
    const result = updateClassSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validPayload);
    }
  });

  it('normalises a grouped rupiah price typed by the tenant', () => {
    const cases: Array<[string, number]> = [
      ['150000', 150000],
      ['1500000', 1500000],
      ['Rp 1.500.000', 1500000],
      ['rp.1500000', 1500000],
      ['1,500,000', 1500000],
      ['1 500 000', 1500000],
      ['1.500', 1500],
    ];

    for (const [typed, expected] of cases) {
      const result = updateClassSchema.safeParse({ ...validPayload, price: typed });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(expected);
      }
    }
  });

  it('rejects a price that is not a whole rupiah amount', () => {
    for (const price of ['1.50', '1.2.3', 'abc', '', '  ', 1.5]) {
      const result = updateClassSchema.safeParse({ ...validPayload, price });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.price?.length).toBe(1);
      }
    }
  });

  it('rejects a negative price with a dedicated message', () => {
    const result = updateClassSchema.safeParse({ ...validPayload, price: '-1500' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.price?.[0]).toBe(
        'Price cannot be negative'
      );
    }
  });

  it('rejects a price beyond the safe integer range', () => {
    const result = updateClassSchema.safeParse({
      ...validPayload,
      price: '9007199254740993',
    });

    expect(result.success).toBe(false);
  });

  it('requires a class name and reports it against the name field', () => {
    const result = updateClassSchema.safeParse({ ...validPayload, name: '   ' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name?.[0]).toBe(
        'Class name is required'
      );
    }
  });

  it('requires the class identifier and a category', () => {
    const result = updateClassSchema.safeParse({
      ...validPayload,
      class_id: '',
      category_id: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.class_id?.[0]).toBe('Please select a valid class');
      expect(errors.category_id?.[0]).toBe('Please select a valid category');
    }
  });

  it('treats a missing description as valid', () => {
    const result = updateClassSchema.safeParse({
      class_id: validPayload.class_id,
      category_id: validPayload.category_id,
      name: validPayload.name,
      price: validPayload.price,
    });

    expect(result.success).toBe(true);
  });

  it('keeps a cleared description as an empty string so it is submitted', () => {
    const result = updateClassSchema.safeParse({ ...validPayload, description: '' });

    expect(result.success).toBe(true);
    if (result.success) {
      // An empty string is what lets the action clear a stored description.
      // Dropping the key instead would make the PATCH a silent no-op.
      expect(result.data.description).toBe('');
      expect('description' in result.data).toBe(true);
    }
  });

  it('refuses to submit a class type because the backend forbids the change', () => {
    const result = updateClassSchema.safeParse({ ...validPayload, type: 'private' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('unrecognized_keys');
    }
  });

  it('refuses to submit a capacity because schedule capacity replaced it', () => {
    const result = updateClassSchema.safeParse({ ...validPayload, capacity: 5 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.code).toBe('unrecognized_keys');
    }
  });
});

/**
 * These cases pin the schedule-item contract to the academic service endpoint
 * (`POST /api/v1/schedules`, KEL-50). The service binds `capacity` as
 * `required,min=1` on every schedule item and stores it on the schedule row,
 * so the payload the action forwards must carry a positive integer — anything
 * weaker is rejected by the backend after a round trip, and anything looser
 * would send data the schema refuses.
 */

const validScheduleItem = {
  day_of_week: 3,
  start_time: '14:00',
  end_time: '15:30',
  capacity: 10,
};

describe('scheduleItemSchema capacity', () => {
  it('carries a valid integer capacity into the parsed payload', () => {
    const result = scheduleItemSchema.safeParse(validScheduleItem);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capacity).toBe(10);
    }
  });

  it('coerces the string a number input submits into an integer', () => {
    const result = scheduleItemSchema.safeParse({ ...validScheduleItem, capacity: '10' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capacity).toBe(10);
    }
  });

  it('rejects an empty capacity before the request is sent', () => {
    const result = scheduleItemSchema.safeParse({ ...validScheduleItem, capacity: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.capacity?.[0]).toBe(
        'Capacity must be at least 1'
      );
    }
  });

  it('rejects a missing capacity', () => {
    const withoutCapacity = {
      day_of_week: validScheduleItem.day_of_week,
      start_time: validScheduleItem.start_time,
      end_time: validScheduleItem.end_time,
    };

    const result = scheduleItemSchema.safeParse(withoutCapacity);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.capacity?.[0]).toBe(
        'Capacity is required'
      );
    }
  });

  it('rejects zero and negative capacities', () => {
    for (const capacity of [0, -1, '0', '-5']) {
      const result = scheduleItemSchema.safeParse({ ...validScheduleItem, capacity });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.capacity?.[0]).toBe(
          'Capacity must be at least 1'
        );
      }
    }
  });

  it('rejects a fractional capacity', () => {
    const result = scheduleItemSchema.safeParse({ ...validScheduleItem, capacity: 2.5 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.capacity?.[0]).toBe(
        'Capacity must be a whole number'
      );
    }
  });

  it('keeps a very large capacity valid because the backend has no upper bound', () => {
    const result = scheduleItemSchema.safeParse({
      ...validScheduleItem,
      capacity: 1000000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capacity).toBe(1000000);
    }
  });
});

describe('createScheduleSchema capacity payload', () => {
  it('forwards the per-slot capacity of multiple slots unchanged', () => {
    const result = createScheduleSchema.safeParse({
      class_id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11',
      schedules: [
        validScheduleItem,
        { ...validScheduleItem, day_of_week: 5, capacity: '4' },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.schedules.map((slot) => slot.capacity)).toEqual([10, 4]);
    }
  });

  it('rejects the whole submission when one slot carries an invalid capacity', () => {
    const result = createScheduleSchema.safeParse({
      class_id: '3b1f0c9a-4a7e-4c1d-9c4e-6f2b0d8a5e11',
      schedules: [validScheduleItem, { ...validScheduleItem, capacity: 0 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod v4 keeps nested array issues under the parent key with the item
      // index preserved in the issue path, which is what the form reads.
      const capacityIssue = result.error.issues.find(
        (issue) => issue.path.join('.') === 'schedules.1.capacity'
      );

      expect(capacityIssue?.message).toBe('Capacity must be at least 1');
    }
  });
});
