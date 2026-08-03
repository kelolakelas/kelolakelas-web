import { expect, it } from 'vitest';
import { buildClassSetupPayload } from './classSetup';

const category = { name: 'Mathematics', description: 'Subject category description' };

it('builds a group payload with normalized schedules', () => {
  const result = buildClassSetupPayload({
    category,
    class: {
      name: 'Algebra Beginner',
      description: 'Class description',
      type: 'group',
      price: 150000,
      capacity: 10,
    },
    schedules: [{
      day_of_week: 1,
      start_time: '09:00',
      end_time: '10:30',
      location: 'Room 101',
    }],
  });

  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.payload.class).not.toHaveProperty('category_id');
    expect(result.payload.schedules).toHaveLength(1);
    expect(result.payload.schedules?.[0].start_time).toBe('09:00:00');
  }
});

it('builds a private payload without schedules', () => {
  const result = buildClassSetupPayload({
    category: { name: 'Private Mathematics' },
    class: {
      name: 'Private Algebra',
      type: 'private',
      price: 250000,
      capacity: 1,
    },
  });

  expect(result.success).toBe(true);
  if (result.success) expect(result.payload).not.toHaveProperty('schedules');
});

it('rejects a group payload without schedules', () => {
  const result = buildClassSetupPayload({
    category,
    class: { name: 'Algebra Beginner', type: 'group', price: 150000, capacity: 10 },
    schedules: [],
  });

  expect(result.success).toBe(false);
  expect(result.message).toContain('Jadwal');
});