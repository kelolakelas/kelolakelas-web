import { describe, expect, it } from 'vitest';
import { catalogQuery, descriptionText, scheduleDetailLabel, scheduleLabels, scheduleOptions } from './catalog';

describe('catalog query helpers', () => {
  it('accepts core filters and uses a safe page size', () => {
    const query = catalogQuery({ search: 'matematika', type: 'group', sort: 'price_asc', page: '2' });
    expect(query.error).toBe(false);
    expect(query.params.toString()).toContain('page_size=12');
    expect(query.params.get('search')).toBe('matematika');
  });

  it('rejects invalid filters', () => {
    expect(catalogQuery({ min_price: '200', max_price: '100' }).error).toBe(true);
    expect(catalogQuery({ type: 'hybrid' }).error).toBe(true);
  });

  it('formats only complete schedule objects', () => {
    expect(scheduleLabels([{ day_of_week: 1, start_time: '09:00:00', end_time: '10:30:00' }, {}])).toEqual(['Senin, 09:00–10:30']);
  });

  it('keeps schedule ids, optional locations and remaining slots for the public detail', () => {
    expect(scheduleOptions([
      { id: 'schedule-1', day_of_week: 1, start_time: '09:00:00', end_time: '10:30:00', location: ' Ruang A ', is_available: true, available_slots: 8 },
      { id: 'schedule-2', day_of_week: 2, start_time: '11:00:00', end_time: '12:00:00', location: null, is_available: false, available_slots: 0 },
      { id: 'schedule-3', day_of_week: 3, start_time: '13:00:00', end_time: '14:00:00' },
    ])).toEqual([
      { id: 'schedule-1', label: 'Senin, 09:00–10:30', available: true, availableSlots: 8, location: 'Ruang A' },
      { id: 'schedule-2', label: 'Selasa, 11:00–12:00', available: false, availableSlots: 0, location: undefined },
      { id: 'schedule-3', label: 'Rabu, 13:00–14:00', available: true, availableSlots: undefined, location: undefined },
    ]);
  });

  it('fails closed for zero slots even with an inconsistent availability flag and ignores malformed locations', () => {
    expect(scheduleOptions([{ id: 'schedule-1', day_of_week: 1, start_time: '09:00:00', end_time: '10:30:00', location: { unsafe: true }, is_available: true, available_slots: 0 }])).toEqual([
      { id: 'schedule-1', label: 'Senin, 09:00–10:30', available: false, availableSlots: 0, location: undefined },
    ]);
    expect(scheduleOptions(null)).toEqual([]);
    expect(scheduleOptions([{ id: 'schedule-2', day_of_week: 8, start_time: '09:00:00', end_time: '10:30:00' }])).toEqual([]);
  });

  it('formats location and remaining seats on public detail, including full and legacy schedules', () => {
    const schedules = scheduleOptions([
      { id: 'a', day_of_week: 1, start_time: '09:00:00', end_time: '10:30:00', location: 'Ruang A', available_slots: 3 },
      { id: 'b', day_of_week: 2, start_time: '11:00:00', end_time: '12:00:00', location: null, available_slots: 0 },
      { id: 'c', day_of_week: 3, start_time: '13:00:00', end_time: '14:00:00' },
    ]);
    expect(schedules.map(scheduleDetailLabel)).toEqual([
      'Senin, 09:00–10:30 · Ruang A · 3 slot tersisa',
      'Selasa, 11:00–12:00 · Penuh',
      'Rabu, 13:00–14:00 · Slot belum diketahui',
    ]);
  });

  it('renders only a safe textual description', () => {
    expect(descriptionText({ text: 'Belajar pecahan' })).toBe('Belajar pecahan');
    expect(descriptionText({ html: '<strong>unsafe</strong>' })).toBeNull();
  });
});
