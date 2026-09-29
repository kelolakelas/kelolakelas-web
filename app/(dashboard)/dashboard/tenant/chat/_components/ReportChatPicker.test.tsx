// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Behaviour test for the KEL-124 report-to-chat picker.
 *
 * The picker mounts only after the server probe confirmed `report:read`, so
 * these tests cover what happens inside: searching and paging through the
 * tenant report list, starting a `report` conversation with the student's
 * parent, and surfacing failures where the member is already looking.
 */

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  createReportChat: vi.fn(),
  searchTenantReports: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/chat-actions', () => ({
  createReportChat: mocks.createReportChat,
}));
vi.mock('../_actions/actions', () => ({
  searchTenantReports: mocks.searchTenantReports,
}));

const { ReportChatPicker } = await import('./ReportChatPicker');

const REPORT_A = '11111111-1111-4111-8111-111111111111';
const REPORT_B = '22222222-2222-4222-8222-222222222222';
const CONVERSATION_ID = 'ab321b1a-63b2-4d3a-8b56-acc739170972';

function page(items: { id: string; title: string }[], page = 1, totalPages = 1) {
  return {
    items: items.map((item) => ({ ...item, created_at: '2026-09-20T10:00:00Z' })),
    pagination: { page, page_size: 10, total_items: items.length, total_pages: totalPages },
  };
}

beforeEach(() => {
  mocks.push.mockClear();
  mocks.createReportChat.mockReset();
  mocks.searchTenantReports.mockReset();
});

afterEach(() => cleanup());

describe('ReportChatPicker', () => {
  it('starts a report conversation and navigates to the tenant inbox', async () => {
    mocks.createReportChat.mockResolvedValue({ data: { id: CONVERSATION_ID }, error: null });
    render(<ReportChatPicker initial={page([{ id: REPORT_A, title: 'Laporan Ananda Budi' }])} />);

    expect(screen.getByText('Laporan Ananda Budi')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mulai chat' }));

    await waitFor(() => expect(mocks.createReportChat).toHaveBeenCalledWith(REPORT_A));
    expect(mocks.push).toHaveBeenCalledWith(`/dashboard/tenant/chat?conversation=${CONVERSATION_ID}`);
  });

  it('searches by title and resets to the first page', async () => {
    mocks.searchTenantReports.mockResolvedValue({
      data: page([{ id: REPORT_B, title: 'Laporan Ananda Ayu' }]),
      error: null,
    });
    render(<ReportChatPicker initial={page([{ id: REPORT_A, title: 'Laporan Ananda Budi' }])} />);

    fireEvent.change(screen.getByLabelText('Cari laporan'), { target: { value: 'Ayu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));

    await waitFor(() => expect(mocks.searchTenantReports).toHaveBeenCalledWith('Ayu', 1));
    expect(await screen.findByText('Laporan Ananda Ayu')).toBeTruthy();
  });

  it('walks pages and reports the current position', async () => {
    mocks.searchTenantReports.mockResolvedValue({
      data: page([{ id: REPORT_B, title: 'Laporan halaman dua' }], 2, 2),
      error: null,
    });
    render(
      <ReportChatPicker initial={page([{ id: REPORT_A, title: 'Laporan halaman satu' }], 1, 2)} />,
    );

    expect(screen.getByRole('status').textContent).toContain('Halaman 1 dari 2');
    fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));

    await waitFor(() => expect(mocks.searchTenantReports).toHaveBeenCalledWith('', 2));
    expect(await screen.findByText('Laporan halaman dua')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Halaman 2 dari 2');
  });

  it('explains an empty result instead of rendering nothing', () => {
    render(<ReportChatPicker initial={page([])} />);

    expect(screen.getByText('Belum ada laporan yang cocok.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mulai chat' })).toBeNull();
  });

  it('shows a revoked permission inline instead of an empty list', async () => {
    mocks.searchTenantReports.mockResolvedValue({
      data: null,
      error: 'forbidden',
      message: 'Anda tidak memiliki izin melihat laporan tenant ini.',
    });
    render(<ReportChatPicker initial={page([{ id: REPORT_A, title: 'Laporan Ananda Budi' }])} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cari' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('tidak memiliki izin');
  });

  it('shows a start refusal inline instead of navigating', async () => {
    mocks.createReportChat.mockResolvedValue({ data: null, error: 'Percakapan tidak ditemukan.' });
    render(<ReportChatPicker initial={page([{ id: REPORT_A, title: 'Laporan Ananda Budi' }])} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mulai chat' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('tidak ditemukan');
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
