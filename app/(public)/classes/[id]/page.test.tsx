import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCatalogClass, getParentStudents, getCookie } = vi.hoisted(() => ({
  getCatalogClass: vi.fn(),
  getParentStudents: vi.fn(),
  getCookie: vi.fn(),
}));

vi.mock('../_queries/queries', () => ({ getCatalogClass }));
vi.mock('@/app/(dashboard)/dashboard/parent/_queries/queries', () => ({ getParentStudents }));
vi.mock('@/lib/api/client', () => ({ getAuthCookieName: () => 'auth_token' }));
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve({ get: getCookie }) }));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement('a', { href, ...props }, children) }));

import ClassDetailPage from './page';

const classItem = {
  id: 'class-1',
  tenant_id: 'tenant-1',
  tenant_name: 'Tenant Academy',
  category_id: 'category-1',
  category_name: 'Mathematics',
  name: 'Algebra 101',
  description: 'Introductory algebra',
  type: 'group',
  price: 250000,
  capacity: 20,
  available_slots: 5,
  is_enrollable: true,
  created_at: '2026-08-14T00:00:00Z',
};

function parentToken() {
  return `header.${Buffer.from(JSON.stringify({ is_parent: true })).toString('base64url')}.signature`;
}

async function renderPage() {
  return renderToStaticMarkup(await ClassDetailPage({ params: Promise.resolve({ id: 'class-1' }) }));
}

describe('ClassDetailPage enrollment states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCatalogClass.mockResolvedValue({ data: classItem });
    getParentStudents.mockResolvedValue({ data: [] });
    getCookie.mockReturnValue(undefined);
  });

  it('renders a guest login state preserving the class URL', async () => {
    const html = await renderPage();
    expect(html).toContain('Login sebagai parent');
    expect(html).toContain('/login?redirectTo=/classes/class-1');
    expect(getParentStudents).not.toHaveBeenCalled();
  });

  it('renders the no-student state for a parent', async () => {
    getCookie.mockReturnValue({ value: parentToken() });
    const html = await renderPage();
    expect(html).toContain('Tambahkan student ke akun parent');
    expect(html).toContain('/dashboard/parent/students');
  });

  it('renders student and billing controls for a parent with students', async () => {
    getCookie.mockReturnValue({ value: parentToken() });
    getParentStudents.mockResolvedValue({ data: [{ id: 'student-1', parent_id: 'parent-1', first_name: 'Alya', last_name: 'Putri' }] });
    const html = await renderPage();
    expect(html).toContain('Alya Putri');
    expect(html).toContain('Siklus billing');
    expect(html).toContain('monthly');
  });

  it('renders the unavailable state for a non-enrollable class', async () => {
    getCookie.mockReturnValue({ value: parentToken() });
    getCatalogClass.mockResolvedValue({ data: { ...classItem, is_enrollable: false } });
    const html = await renderPage();
    expect(html).toContain('Class tidak tersedia untuk enrollment');
    expect(getParentStudents).toHaveBeenCalled();
  });
});
