// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Behaviour test for the KEL-141 report-to-chat entry button.
 *
 * Get-or-create lives server-side: the button posts `{kind: 'report',
 * subject_id}` once per press through `createReportChat` and navigates to the
 * returned conversation, so pressing again on the same report lands in the
 * same room. A refusal (unknown id, another parent's report, or missing
 * permission) is shown where the parent is already looking instead of
 * navigating away. Mirrors `ScheduleRequestChatButton.test.tsx` (KEL-124).
 */

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  createReportChat: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/chat-actions', () => ({
  createReportChat: mocks.createReportChat,
}));

const { ReportChatButton } = await import('./ReportChatButton');

const REPORT_ID = '223e4567-e89b-12d3-a456-426614174001';
const CONVERSATION_ID = 'ab321b1a-63b2-4d3a-8b56-acc739170972';

beforeEach(() => {
  mocks.push.mockClear();
  mocks.createReportChat.mockReset();
});

afterEach(() => cleanup());

describe('ReportChatButton', () => {
  it('get-or-creates the report conversation and navigates to it', async () => {
    mocks.createReportChat.mockResolvedValue({ data: { id: CONVERSATION_ID }, error: null });
    render(<ReportChatButton reportId={REPORT_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Diskusikan laporan ini via chat' }));

    await waitFor(() => expect(mocks.createReportChat).toHaveBeenCalledWith(REPORT_ID));
    expect(mocks.push).toHaveBeenCalledWith(`/dashboard/parent/chat?conversation=${CONVERSATION_ID}`);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lands in the same conversation when pressed again on the same report', async () => {
    mocks.createReportChat.mockResolvedValue({ data: { id: CONVERSATION_ID }, error: null });
    render(<ReportChatButton reportId={REPORT_ID} />);

    const entry = screen.getByRole('button', { name: 'Diskusikan laporan ini via chat' });
    fireEvent.click(entry);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    fireEvent.click(entry);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(2));

    expect(mocks.push).toHaveBeenNthCalledWith(2, `/dashboard/parent/chat?conversation=${CONVERSATION_ID}`);
  });

  it('shows a refusal inline instead of navigating', async () => {
    mocks.createReportChat.mockResolvedValue({ data: null, error: 'Anda tidak memiliki akses ke percakapan ini.' });
    render(<ReportChatButton reportId={REPORT_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Diskusikan laporan ini via chat' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('tidak memiliki akses');
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('shows a retryable message when the service is unavailable', async () => {
    mocks.createReportChat.mockResolvedValue({ data: null, error: 'Layanan chat sedang tidak tersedia. Coba lagi nanti.' });
    render(<ReportChatButton reportId={REPORT_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Diskusikan laporan ini via chat' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('tidak tersedia');
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
