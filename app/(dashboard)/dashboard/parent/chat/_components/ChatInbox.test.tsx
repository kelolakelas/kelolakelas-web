// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInbox } from './ChatInbox';
import type { ChatConversation, ChatMessage } from '@/lib/chat';

vi.mock('@/lib/chat-actions', () => ({
  listChatConversations: vi.fn(), listChatMessages: vi.fn(), markChatRead: vi.fn(),
  sendChatMessage: vi.fn(), issueChatTicket: vi.fn(), createStaffChat: vi.fn(),
  getChatConversation: vi.fn(),
}));
import { getChatConversation, issueChatTicket, listChatConversations, listChatMessages, markChatRead, sendChatMessage } from '@/lib/chat-actions';

const room: ChatConversation = { id: 'ab321b1a-63b2-4d3a-8b56-acc739170972', kind: 'staff', context: {}, last_message: null, last_message_at: null, unread_count: 0 };
beforeEach(() => {
  vi.mocked(listChatConversations).mockResolvedValue({ data: [room], error: null });
  vi.mocked(listChatMessages).mockResolvedValue({ data: [], error: null });
  vi.mocked(markChatRead).mockResolvedValue({ data: null, error: null });
  vi.mocked(sendChatMessage).mockResolvedValue({ data: null, error: 'Layanan chat sedang tidak tersedia.' });
  vi.mocked(getChatConversation).mockResolvedValue({ data: null, error: 'Percakapan tidak ditemukan.' });
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

describe('chat deep-link (KEL-124)', () => {
  const requested: ChatConversation = {
    id: '9a1c3e5f-2b4d-4e6f-8a0b-1c2d3e4f5a6b',
    kind: 'schedule_request',
    context: { class_name: 'Matematika Private' },
    last_message: null,
    last_message_at: null,
    unread_count: 0,
  };

  it('selects the linked conversation instead of the first row', async () => {
    vi.mocked(listChatConversations).mockResolvedValue({ data: [room, requested], error: null });
    render(<ChatInbox initial={[room, requested]} userId="me" tenant={false} initialConversationId={requested.id} />);

    // The heading names the active room: the entry button's target, not the
    // default first row.
    expect(screen.getByRole('heading', { name: 'Matematika Private' })).toBeTruthy();
    await waitFor(() => expect(listChatMessages).toHaveBeenCalledWith(requested.id));
    expect(getChatConversation).not.toHaveBeenCalled();
  });

  it('fetches a just-created conversation missing from the first list read', async () => {
    vi.mocked(listChatConversations).mockResolvedValue({ data: [room], error: null });
    vi.mocked(getChatConversation).mockResolvedValue({ data: requested, error: null });
    render(<ChatInbox initial={[room]} userId="me" tenant={false} initialConversationId={requested.id} />);

    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' }));

    await waitFor(() => expect(getChatConversation).toHaveBeenCalledWith(requested.id));
    await screen.findByRole('heading', { name: 'Matematika Private' });
  });

  it('falls back to no selection when the linked conversation cannot be read', async () => {
    vi.mocked(listChatConversations).mockResolvedValue({ data: [room], error: null });
    render(<ChatInbox initial={[room]} userId="me" tenant={false} initialConversationId={requested.id} />);

    // The missing room has no selectable row, so the detail pane keeps the
    // neutral prompt instead of rendering a room the member cannot read.
    // (In the real flow the entry button only navigates on success, so this
    // covers stale links, not denials — those surface inline on the button.)
    expect(screen.getByRole('heading', { name: 'Pilih percakapan' })).toBeTruthy();
  });
});

describe('system notifications (KEL-157)', () => {
  const notificationId = 'c4321b1a-63b2-4d3a-8b56-acc739170973';
  const notification: ChatConversation = {
    id: notificationId,
    kind: 'notification',
    context: { tenant_name: 'Sekolah Pelita' },
    last_message: null,
    last_message_at: null,
    unread_count: 2,
  };

  it('renders the notification row with tenant label and unread count', () => {
    render(<ChatInbox initial={[notification]} userId="me" tenant={false} />);
    // Active defaults to the first row, so the title appears in the row and
    // the detail heading.
    expect(screen.getAllByText('Notifikasi sistem')).toHaveLength(2);
    expect(screen.getByText('Sekolah Pelita')).toBeTruthy();
    expect(screen.getByText('2 belum dibaca')).toBeTruthy();
  });

  it('renders system messages distinctly, clears unread on read, and hides the reply form', async () => {
    const systemMessage: ChatMessage = {
      id: 'd5321b1a-63b2-4d3a-8b56-acc739170974',
      conversation_id: notificationId,
      sender_user_id: null,
      sender_kind: 'system',
      body: 'Jadwal kelas berubah menjadi jam 10.',
      client_message_id: 'system-key-1',
      created_at: '2026-09-29T02:20:40+07:00',
    };
    vi.mocked(listChatMessages).mockResolvedValue({ data: [systemMessage], error: null });
    render(<ChatInbox initial={[notification]} userId="me" tenant={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Notifikasi sistem/ }));
    await waitFor(() => expect(markChatRead).toHaveBeenCalledWith(notificationId));
    await screen.findByText('Jadwal kelas berubah menjadi jam 10.');
    expect(screen.getByText('Sistem')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('2 belum dibaca')).toBeNull());
    expect(screen.queryByRole('textbox', { name: 'Pesan' })).toBeNull();
    expect(screen.getByText(/satu arah/)).toBeTruthy();
  });

  it('renders unknown conversation kinds and senders without throwing', async () => {
    const alien = { ...room, id: 'e6321b1a-63b2-4d3a-8b56-acc739170975', kind: 'reminder', context: {} };
    const alienMessage: ChatMessage = {
      id: 'f7321b1a-63b2-4d3a-8b56-acc739170976',
      conversation_id: alien.id,
      sender_user_id: 'someone-else',
      sender_kind: 'robot',
      body: 'Pesan asing',
      client_message_id: 'alien-key',
      created_at: '2026-09-29T02:20:40+07:00',
    };
    vi.mocked(listChatMessages).mockResolvedValue({ data: [alienMessage], error: null });
    render(<ChatInbox initial={[alien]} userId="me" tenant={false} />);

    // List header ("Percakapan"), row button, and detail heading all share
    // the fallback text when the kind is unknown.
    expect(screen.getAllByText('Percakapan')).toHaveLength(3);
    expect(screen.getAllByRole('heading', { name: 'Percakapan' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Percakapan/ }));
    await screen.findByText('Pesan asing');
    expect(screen.getByText('Pengirim tidak dikenal')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Pesan' })).toBeTruthy();
  });
});
