// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CategoryControl } from './CategoryControl';
import { deleteCategory, updateCategory } from '../_actions/classActions';
vi.mock('../_actions/classActions', () => ({ deleteCategory: vi.fn(), updateCategory: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const category = { id: 'c', name: 'Math', tenant_id: 't', created_at: '2026-10-13' };
it('retains unsaved rename input and confirmation after referenced delete refusal', async () => {
  vi.mocked(deleteCategory).mockResolvedValue({ success: false, message: 'This category has active classes and cannot be deleted.' });
  const view = render(<CategoryControl category={category} canUpdate canDelete />);
  fireEvent.click(view.getByText('Edit category'));
  fireEvent.change(view.getByLabelText('Category name'), { target: { value: 'Draft rename' } });
  fireEvent.click(view.getByText('Delete category'));
  fireEvent.click(view.getByText('Confirm delete'));
  await waitFor(() => expect(view.getByRole('alert').textContent).toContain('active classes'));
  expect((view.getByLabelText('Category name') as HTMLInputElement).value).toBe('Draft rename');
  // The error can render before the async transition clears its pending label.
  await waitFor(() => expect((view.getByRole('button', { name: 'Confirm delete' }) as HTMLButtonElement).disabled).toBe(false));
  expect(deleteCategory).toHaveBeenCalledWith('c');
  expect(updateCategory).not.toHaveBeenCalled();
});
it('submits edited name and closes the editor only after success', async () => {
  vi.mocked(updateCategory).mockResolvedValue({ success: true, message: 'Category renamed.' });
  const view = render(<CategoryControl category={category} canUpdate canDelete />);
  fireEvent.click(view.getByText('Edit category'));
  fireEvent.change(view.getByLabelText('Category name'), { target: { value: 'New name' } });
  fireEvent.click(view.getByText('Save category'));
  await waitFor(() => expect(view.queryByLabelText('Category name')).toBeNull());
  expect(vi.mocked(updateCategory).mock.calls[0][1].get('name')).toBe('New name');
  expect(view.getByRole('status').textContent).toBe('Category renamed.');
  expect(vi.mocked(updateCategory).mock.calls[0][1].has('description')).toBe(false);
});
it('prefills and submits edited description and retains draft on no-clear error', async () => {
  vi.mocked(updateCategory).mockResolvedValue({ success: false, message: 'Invalid fields', errors: { description: ['Description cannot be cleared.'] } });
  const view = render(<CategoryControl category={{ ...category, description: 'Existing description' }} canUpdate canDelete />);
  fireEvent.click(view.getByText('Edit category'));
  expect((view.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Existing description');
  fireEvent.change(view.getByLabelText('Description'), { target: { value: '' } });
  fireEvent.click(view.getByText('Save category'));
  await waitFor(() => expect(view.getByRole('alert').textContent).toContain('cannot be cleared'));
  expect((view.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('');
  vi.mocked(updateCategory).mockResolvedValue({ success: true, message: 'Category renamed.' });
  fireEvent.change(view.getByLabelText('Description'), { target: { value: 'Edited description' } });
  fireEvent.click(view.getByText('Save category'));
  await waitFor(() => expect(view.queryByLabelText('Description')).toBeNull());
  expect(vi.mocked(updateCategory).mock.calls[1][1].get('description')).toBe('Edited description');
});
