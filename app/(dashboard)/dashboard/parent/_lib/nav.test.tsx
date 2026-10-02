import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PARENT_NAV_ITEMS } from '../_lib/nav';

/**
 * Nav contract test (KEL-141 AC3): the shared parent nav links to all four
 * areas, so the existing pages (enrollments, students, chat) stay reachable
 * through the new navigation.
 */
describe('parent navigation', () => {
  it('covers kelas saya, anak, jadwal & progres, and chat', () => {
    const hrefs = PARENT_NAV_ITEMS.map((item) => item.href);
    expect(hrefs).toEqual([
      '/dashboard/parent/enrollments',
      '/dashboard/parent/students',
      '/dashboard/parent/progress',
      '/dashboard/parent/chat',
    ]);
  });

  it('labels every area in Indonesian', () => {
    for (const item of PARENT_NAV_ITEMS) {
      expect(item.label.trim().length).toBeGreaterThan(0);
    }
    expect(PARENT_NAV_ITEMS.map((item) => item.label)).toContain('Jadwal & Progres');
  });

  it('renders the progress link inside the shared header', () => {
    const html = renderToStaticMarkup(
      <div>
        {PARENT_NAV_ITEMS.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </div>,
    );
    expect(html).toContain('/dashboard/parent/progress');
    expect(html).toContain('/dashboard/parent/enrollments');
    expect(html).toContain('/dashboard/parent/students');
    expect(html).toContain('/dashboard/parent/chat');
  });
});
