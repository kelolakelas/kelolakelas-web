// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ClassListTable } from './ClassListTable';
import type { ClassEntity } from '../_lib/schema';

afterEach(cleanup);
const record: ClassEntity = {
  id: 'class-1', tenant_id: 'tenant-1', category_id: 'cat-1', name: 'Algebra',
  type: 'group', price: 150000, created_at: '2026-10-16T00:00:00Z',
  category: { id: 'cat-1', name: 'Matematika' },
};

describe('tenant class category identity (KEL-190)', () => {
  it('renders the embedded category in desktop and mobile without a separate category list', () => {
    const view = render(<ClassListTable classes={[record]} categories={[]} schedules={[]} />);
    expect(view.getAllByText('Matematika')).toHaveLength(2);
    expect(view.getByRole('cell', { name: 'Matematika' })).toBeDefined();
    expect(view.getAllByText('Per schedule')).toHaveLength(2);
  });

  it('searches by embedded category name even when the class name differs', () => {
    const view = render(<ClassListTable classes={[record]} categories={[]} schedules={[]} />);
    const search = view.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: 'mAtEmAtIkA' } });
    expect(view.getByRole('heading', { name: 'Algebra' })).toBeDefined();
    expect(view.getByRole('cell', { name: 'Algebra' })).toBeDefined();
    fireEvent.change(search, { target: { value: 'Bahasa' } });
    expect(view.queryByRole('heading', { name: 'Algebra' })).toBeNull();
    expect(view.queryByRole('cell', { name: 'Algebra' })).toBeNull();
    fireEvent.change(search, { target: { value: '' } });
    expect(view.getByRole('heading', { name: 'Algebra' })).toBeDefined();
    expect(view.getByRole('cell', { name: 'Algebra' })).toBeDefined();
  });

  it.each(['', 'deleted-category'])('shows a dash in both layouts for missing category %s', (category_id) => {
    const view = render(<ClassListTable classes={[{ ...record, category_id, category: undefined }]} categories={[]} schedules={[]} />);
    expect(view.queryByText('Matematika')).toBeNull();
    expect(view.getByRole('cell', { name: '—' })).toBeDefined();
    const mobile = view.container.querySelector('.md\\:hidden');
    expect(mobile?.textContent).toContain('—');
    expect(view.getByRole('heading', { name: 'Algebra' })).toBeDefined();
    expect(view.getByRole('cell', { name: 'Algebra' })).toBeDefined();
  });
});
