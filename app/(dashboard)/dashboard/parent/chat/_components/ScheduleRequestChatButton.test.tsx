// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Behaviour test for the KEL-124 schedule-request chat entry button.
 *
 * Get-or-create lives server-side: the button posts `{kind, subject_id}` once
 * per press through `createScheduleRequestChat` and navigates to the returned
 * conversation, so pressing again on the same row lands in the same room. A
 * refusal (unknown id, another tenant's row, missing permission) is shown
 * where the member is already looking instead of navigating away.
 */

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  createScheduleRequestChat: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/chat-actions', () => ({
  createScheduleRequestChat: mocks.createScheduleRequestChat,
}));

const { ScheduleRequestChatButton } = await import('./ScheduleRequestChatButton');

const REQUEST_ID = '9a1c3e5f-2b4d-4e6f-8a0b-1c2d3e4f5a6b';
const CONVERSATION_ID = 'ab321b1a-63b2-4d3a-8b56-acc739170972';

function buttonProps() {
  return {
    requestId: REQUEST_ID,
    label: 'Chat dengan tenant',
    chatPath: '/dashboard/parent/chat',
    className: 'entry',
  };
}

beforeEach(() => {
  mocks.push.mockClear();
  mocks.createScheduleRequestChat.mockReset();
});

afterEach(() => cleanup());

describe('ScheduleRequestChatButton', () => {
  it('get-or-creates the conversation and navigates to it', async () => {
    mocks.createScheduleRequestChat.mockResolvedValue({ data: { id: CONVERSATION_ID }, error: null });
    render(<ScheduleRequestChatButton {...buttonProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Chat dengan tenant' }));

    await waitFor(() => expect(mocks.createScheduleRequestChat).toHaveBeenCalledWith(REQUEST_ID));
    expect(mocks.push).toHaveBeenCalledWith(`/dashboard/parent/chat?conversation=${CONVERSATION_ID}`);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lands in the same conversation when pressed again on the same row', async () => {
    mocks.createScheduleRequestChat.mockResolvedValue({ data: { id: CONVERSATION_ID }, error: null });
    render(<ScheduleRequestChatButton {...buttonProps()} />);

    const entry = screen.getByRole('button', { name: 'Chat dengan tenant' });
    fireEvent.click(entry);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    fireEvent.click(entry);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(2));

    expect(mocks.push).toHaveBeenNthCalledWith(2, `/dashboard/parent/chat?conversation=${CONVERSATION_ID}`);
  });

  it('shows a refusal inline instead of navigating', async () => {
    mocks.createScheduleRequestChat.mockResolvedValue({ data: null, error: 'Anda tidak memiliki akses ke percakapan ini.' });
    render(<ScheduleRequestChatButton {...buttonProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Chat dengan tenant' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('tidak memiliki akses');
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('shows a retryable message when the service is unavailable', async () => {
    mocks.createScheduleRequestChat.mockResolvedValue({ data: null, error: 'Layanan chat sedang tidak tersedia. Coba lagi nanti.' });
    render(<ScheduleRequestChatButton {...buttonProps()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Chat dengan tenant' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('tidak tersedia');
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
