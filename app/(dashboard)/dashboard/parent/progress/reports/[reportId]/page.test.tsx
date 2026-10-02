import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * Render test for the parent report detail page (KEL-141).
 *
 * The page is a Server Component, so its query is mocked and the rendered
 * markup is asserted. What matters: the report body renders with the chat
 * entry point (requirement 4), while another parent's id renders the
 * not-found state and never leaks the row (AC5).
 */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (name === 'auth_token' ? { name, value: 'session-token' } : undefined),
  })),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const REPORT = '223e4567-e89b-12d3-a456-426614174001';

const getStudentReportDetail = vi.fn();

vi.mock('../../_queries/queries', () => ({
  getStudentReportDetail: (...args: unknown[]) => getStudentReportDetail(...args),
}));

const { default: ParentReportDetailPage } = await import('./page');

async function render(reportId: string): Promise<string> {
  const node = await ParentReportDetailPage({
    params: Promise.resolve({ reportId }),
    searchParams: Promise.resolve({}),
  });
  return renderToStaticMarkup(node);
}

describe('parent report detail page', () => {
  it('renders the report with the chat entry point', async () => {
    getStudentReportDetail.mockResolvedValue({
      data: { id: REPORT, title: 'Laporan Tengah Semester', evaluation_notes: 'Rajin.', score: 90 },
      error: null,
    });

    const html = await render(REPORT);

    expect(html).toContain('Laporan Tengah Semester');
    expect(html).toContain('Rajin.');
    expect(html).toContain('Diskusikan laporan ini via chat');
  });

  it('renders the not-found state for another parent id without leaking the row', async () => {
    getStudentReportDetail.mockResolvedValue({
      data: null,
      error: 'not_found',
      message: 'Laporan tidak ditemukan pada akun Anda.',
    });

    const html = await render('323e4567-e89b-12d3-a456-426614174099');

    expect(html).toContain('Laporan tidak ditemukan pada akun Anda.');
    expect(html).not.toContain('Diskusikan laporan ini via chat');
  });

  it('reports a forbidden read as access denied', async () => {
    getStudentReportDetail.mockResolvedValue({
      data: null,
      error: 'forbidden',
      message: 'Anda tidak memiliki akses ke data progres anak ini.',
    });

    const html = await render(REPORT);

    expect(html).toContain('Akses ditolak');
  });
});
