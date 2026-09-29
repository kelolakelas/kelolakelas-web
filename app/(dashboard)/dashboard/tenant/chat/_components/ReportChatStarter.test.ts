import { describe, expect, it, vi } from 'vitest';

/**
 * Visibility contract for the KEL-124 report-to-chat entry section.
 *
 * Requirement 4: a member without `report:read` never sees the report
 * picker. The section probes `GET /api/v1/reports` once on the server and
 * hides itself entirely on `forbidden`, so there is no flash of the control
 * and nothing to assert in a browser.
 */

const mocks = vi.hoisted(() => ({
  getTenantReports: vi.fn(),
}));

vi.mock('../_queries/queries', () => ({
  getTenantReports: mocks.getTenantReports,
}));

const { ReportChatStarter } = await import('./ReportChatStarter');

describe('ReportChatStarter', () => {
  it('hides the whole section when the member lacks report:read', async () => {
    mocks.getTenantReports.mockResolvedValue({
      data: null,
      error: 'forbidden',
      message: 'Anda tidak memiliki izin melihat laporan tenant ini.',
    });

    await expect(ReportChatStarter()).resolves.toBeNull();
  });

  it('shows a retryable message instead of the picker on outage', async () => {
    mocks.getTenantReports.mockResolvedValue({
      data: null,
      error: 'api',
      message: 'Daftar laporan belum dapat dimuat.',
    });

    const section = await ReportChatStarter();
    expect(section).not.toBeNull();
  });

  it('mounts the picker once the probe confirms report:read', async () => {
    mocks.getTenantReports.mockResolvedValue({
      data: {
        items: [],
        pagination: { page: 1, page_size: 10, total_items: 0, total_pages: 0 },
      },
      error: null,
    });

    const picker = await ReportChatStarter();
    expect(picker).not.toBeNull();
    expect(mocks.getTenantReports).toHaveBeenCalledWith({ search: '', page: 1 });
  });
});
