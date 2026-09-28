// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInbox } from './ChatInbox';
import type { ChatConversation } from '@/lib/chat';

vi.mock('@/lib/chat-actions', () => ({
  listChatConversations: vi.fn(), listChatMessages: vi.fn(), markChatRead: vi.fn(),
  sendChatMessage: vi.fn(), issueChatTicket: vi.fn(), createStaffChat: vi.fn(),
}));
import { listChatConversations, listChatMessages, markChatRead, sendChatMessage } from '@/lib/chat-actions';

const room: ChatConversation = { id: 'ab321b1a-63b2-4d3a-8b56-acc739170972', kind: 'staff', context: {}, last_message: null, last_message_at: null, unread_count: 0 };
beforeEach(() => {
  vi.mocked(listChatConversations).mockResolvedValue({ data: [room], error: null });
  vi.mocked(listChatMessages).mockResolvedValue({ data: [], error: null });
  vi.mocked(markChatRead).mockResolvedValue({ data: null, error: null });
  vi.mocked(sendChatMessage).mockResolvedValue({ data: null, error: 'Layanan chat sedang tidak tersedia.' });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('chat fallback', () => {
  it('renders disconnected status and loads messages without a socket', async () => {
    render(<ChatInbox initial={[room]} userId="me" tenant={false} />);
    expect(screen.getByRole('status').textContent).toContain('Terputus');
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));
    await waitFor(() => expect(listChatConversations).toHaveBeenCalled());
    fireEvent.change(screen.getByRole('textbox', { name: 'Pesan' }), { target: { value: '<b>text</b>\nsecond line' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Gagal dikirim/ })).toBeTruthy());
    expect(screen.getByText(/<b>text<\/b>/)).toBeTruthy();
    expect(sendChatMessage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Gagal dikirim/ }));
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalledTimes(2));
    expect(vi.mocked(sendChatMessage).mock.calls[0][2]).toBe(vi.mocked(sendChatMessage).mock.calls[1][2]);
  });
});
