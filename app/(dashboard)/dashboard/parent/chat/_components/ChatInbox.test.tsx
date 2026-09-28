// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInbox } from './ChatInbox';
import type { ChatConversation, ChatMessage } from '@/lib/chat';

vi.mock('@/lib/chat-actions', () => ({
  listChatConversations: vi.fn(), listChatMessages: vi.fn(), markChatRead: vi.fn(),
  sendChatMessage: vi.fn(), issueChatTicket: vi.fn(), createStaffChat: vi.fn(),
}));
import { issueChatTicket, listChatConversations, listChatMessages, markChatRead, sendChatMessage } from '@/lib/chat-actions';

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

  it('clears a failed send alert after retry succeeds, even without a socket', async () => {
    render(<ChatInbox initial={[room]} userId="me" tenant={false} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Pesan' }), { target: { value: 'Retry me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
    await screen.findByRole('alert');
    const clientId = vi.mocked(sendChatMessage).mock.calls[0][2];
    const confirmed: ChatMessage = { id: 'server', conversation_id: room.id, sender_user_id: 'me', sender_kind: 'parent', body: 'Retry me', client_message_id: clientId, created_at: '2026-09-29T02:20:40+07:00' };
    vi.mocked(sendChatMessage).mockResolvedValue({ data: confirmed, error: null });
    fireEvent.click(screen.getByRole('button', { name: /Gagal dikirim/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.queryByRole('button', { name: /Gagal dikirim/ })).toBeNull();
    expect(sendChatMessage).toHaveBeenCalledTimes(2);
  });

  it('clears a stale alert when the socket reconnects', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_CHAT_WS_URL;
    const originalWebSocket = globalThis.WebSocket;
    const socketState: { opened?: () => void } = {};
    class TestSocket {
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      close() {}
      constructor() { socketState.opened = () => this.onopen?.(); }
    }
    process.env.NEXT_PUBLIC_CHAT_WS_URL = 'ws://localhost:8000';
    vi.stubGlobal('WebSocket', TestSocket);
    vi.mocked(issueChatTicket).mockResolvedValue({ data: { ticket: 'ticket', expires_at: '' }, error: null });
    try {
      render(<ChatInbox initial={[room]} userId="me" tenant={false} />);
      await waitFor(() => expect(socketState.opened).toBeDefined());
      fireEvent.change(screen.getByRole('textbox', { name: 'Pesan' }), { target: { value: 'Failure' } });
      fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
      await screen.findByRole('alert');
      socketState.opened?.();
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
      expect(screen.getByRole('status').textContent).toBe('Terhubung');
    } finally {
      cleanup();
      vi.stubGlobal('WebSocket', originalWebSocket);
      if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_CHAT_WS_URL;
      else process.env.NEXT_PUBLIC_CHAT_WS_URL = originalUrl;
    }
  });

  it('clears a stale alert after a successful manual refresh but retains a partial refresh failure', async () => {
    render(<ChatInbox initial={[room]} userId="me" tenant={false} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Pesan' }), { target: { value: 'Failure' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
    await screen.findByRole('alert');
    vi.mocked(listChatMessages).mockResolvedValueOnce({ data: null, error: 'Pesan gagal dimuat.' });
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Pesan gagal dimuat.'));
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
