import { describe, expect, it } from 'vitest';
import { catalogQuery, descriptionText, scheduleLabels } from './catalog';

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

  it('renders only a safe textual description', () => {
    expect(descriptionText({ text: 'Belajar pecahan' })).toBe('Belajar pecahan');
    expect(descriptionText({ html: '<strong>unsafe</strong>' })).toBeNull();
  });
});
