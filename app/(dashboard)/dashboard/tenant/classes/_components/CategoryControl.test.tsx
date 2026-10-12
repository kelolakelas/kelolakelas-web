import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CategoryControl } from './CategoryControl';
import { ClassListTable } from './ClassListTable';
import { categoryWritePermissions } from '../_lib/schema';

vi.mock('../_actions/classActions', () => ({ updateCategory: vi.fn(), deleteCategory: vi.fn() }));
const category = { id: 'c', name: 'Renamed subject', tenant_id: 'tenant', created_at: '2026-10-13T00:00:00Z' };

describe('category controls', () => {
  it('fails closed with unreadable membership even if permissions are present', () => {
    expect(categoryWritePermissions({ state: 'error', membership: { permissions: ['category:update', 'category:delete'] } })).toEqual({ canUpdate: false, canDelete: false });
    expect(categoryWritePermissions({ state: 'ok', membership: null })).toEqual({ canUpdate: false, canDelete: false });
  });
  it('gates permissions independently', () => {
    expect(categoryWritePermissions({ state: 'ok', membership: { permissions: ['category:delete'] } })).toEqual({ canUpdate: false, canDelete: true });
    expect(categoryWritePermissions({ state: 'ok', membership: { permissions: ['category:update'] } })).toEqual({ canUpdate: true, canDelete: false });
  });
  it('renders only granted controls', () => {
    const html = renderToStaticMarkup(<CategoryControl category={category} canUpdate={false} canDelete />);
    expect(html).toContain('Delete category');
    expect(html).not.toContain('Edit category');
    expect(renderToStaticMarkup(<CategoryControl category={category} canUpdate={false} canDelete={false} />)).not.toContain('category</button>');
  });
  it('keeps categories tab available with unused categories and no classes', () => {
    const html = renderToStaticMarkup(<ClassListTable categories={[category]} classes={[]} schedules={[]} />);
    expect(html).toContain('Categories (1)');
    expect(html).not.toContain('No Classes Configured Yet');
  });
});
