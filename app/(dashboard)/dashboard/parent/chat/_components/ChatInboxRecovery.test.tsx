// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ChatConversation, ChatMessage } from '@/lib/chat';
vi.mock('@/lib/chat-actions', () => ({ listChatConversations: vi.fn(), listChatMessages: vi.fn(), getChatConversation: vi.fn(), markChatRead: vi.fn(), sendChatMessage: vi.fn(), issueChatTicket: vi.fn(), createStaffChat: vi.fn() }));
import { getChatConversation, listChatConversations, listChatMessages, markChatRead, issueChatTicket, sendChatMessage } from '@/lib/chat-actions';
import { ChatInbox } from './ChatInbox';
const rooms: ChatConversation[] = Array.from({ length: 105 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, kind: 'schedule_request', context: { class_name: `Room ${i}` }, last_message: null, last_message_at: null, unread_count: 0 }));
const message = (id: string): ChatMessage => ({ id: `m-${id}`, conversation_id: id, sender_user_id: 'parent', sender_kind: 'parent', body: `Message ${id}`, client_message_id: id, created_at: '2026-10-27T00:00:00Z' });
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  vi.stubEnv('NEXT_PUBLIC_CHAT_WS_URL', '');
  vi.mocked(listChatConversations).mockImplementation(async (page = 1) => ({ data: rooms.slice((page - 1) * 100, page * 100), error: null }));
  vi.mocked(getChatConversation).mockImplementation(async id => ({ data: rooms.find(room => room.id === id)!, error: null }));
  vi.mocked(listChatMessages).mockImplementation(async id => ({ data: [message(id)], error: null }));
  vi.mocked(markChatRead).mockResolvedValue({ data: null, error: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('loads older rooms and retains the active room through poll and list reordering without duplicates', async () => {
  await act(async () => { render(<ChatInbox initial={rooms.slice(0, 100)} userId="admin" tenant />); });
  expect(screen.queryByRole('button', { name: /Room 104/ })).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Muat percakapan lebih lama' })); });
  expect(listChatConversations).toHaveBeenCalledWith(2);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Room 104/ })); });
  expect(screen.getByRole('heading', { name: 'Room 104' })).toBeTruthy();
  vi.mocked(listChatConversations).mockImplementation(async (page = 1) => ({ data: page === 1 ? rooms.slice(1, 101) : rooms.slice(100), error: null }));
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(screen.getByRole('heading', { name: 'Room 104' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /^Room 100\b/ })).toHaveLength(1);
});
it('recovers a direct-linked room outside page100 on timer; clears inaccessible content on outage/revoke', async () => {
  const id = rooms[104].id;
  await act(async () => { render(<ChatInbox initial={rooms.slice(0, 100)} userId="admin" tenant initialConversationId={id} />); });
  expect(screen.getByRole('heading', { name: 'Room 104' })).toBeTruthy();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(screen.getByRole('heading', { name: 'Room 104' })).toBeTruthy();
  vi.mocked(listChatConversations).mockResolvedValue({ data: null, error: 'Layanan chat tidak tersedia', reason: 'unavailable' });
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(screen.getByRole('alert').textContent).toContain('tidak tersedia');
  expect(screen.queryByText(/Belum ada percakapan/)).toBeNull();
  expect(screen.queryByText(message(id).body)).toBeNull();
  vi.mocked(listChatConversations).mockResolvedValue({ data: rooms.slice(0, 100), error: null });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' })); });
  expect(screen.getByRole('heading', { name: 'Room 104' })).toBeTruthy();
  vi.mocked(getChatConversation).mockResolvedValue({ data: null, error: 'Akses dicabut', reason: 'denied' });
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(screen.queryByRole('heading', { name: 'Room 104' })).toBeNull();
  expect(screen.queryByText(message(id).body)).toBeNull();
  expect(screen.queryByRole('textbox', { name: 'Pesan' })).toBeNull();
});
it('discards an older list response after a newer refresh and after a context remount', async () => {
  let finish!: (value: { data: ChatConversation[]; error: null }) => void;
  await act(async () => { render(<ChatInbox initial={[rooms[0]]} userId="admin" tenant scope="A" />); });
  vi.mocked(listChatConversations).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ data: [rooms[0], rooms[2]], error: null });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' })); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' })); });
  expect(screen.getByRole('button', { name: /^Room 2\b/ })).toBeTruthy();
  await act(async () => finish({ data: [rooms[0], rooms[1]], error: null }));
  expect(screen.queryByRole('button', { name: /^Room 1\b/ })).toBeNull();
  cleanup();
  await act(async () => { render(<ChatInbox initial={[rooms[3]]} userId="admin" tenant scope="B" />); });
  expect(screen.getByRole('heading', { name: 'Room 3' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Room 2\b/ })).toBeNull();
});
it('preserves paging intent when poll starts before the older-page request completes', async () => {
  let finish!: (value: { data: ChatConversation[]; error: null }) => void;
  let blocked = false;
  vi.mocked(listChatConversations).mockImplementation(async (page = 1) => {
    if (page === 2 && !blocked) { blocked = true; return new Promise(resolve => { finish = resolve; }); }
    return { data: rooms.slice((page - 1) * 100, page * 100), error: null };
  });
  await act(async () => { render(<ChatInbox initial={rooms.slice(0, 100)} userId="admin" tenant />); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Muat percakapan lebih lama' })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(screen.getByRole('button', { name: /^Room 104\b/ })).toBeTruthy();
  await act(async () => finish({ data: rooms.slice(100), error: null }));
  expect(screen.getByRole('button', { name: /^Room 104\b/ })).toBeTruthy();
});
it('does not acknowledge a read acknowledgment with another read mutation', async () => {
  let receive!: (event: { data: string }) => void;
  vi.stubEnv('NEXT_PUBLIC_CHAT_WS_URL', 'ws://localhost:8000');
  vi.stubGlobal('WebSocket', class { onmessage?: (event: { data: string }) => void; onopen?: () => void; close() {} constructor() { receive = event => this.onmessage?.(event); } });
  vi.mocked(issueChatTicket).mockResolvedValue({ data: { ticket: 'fixture', expires_at: '' }, error: null });
  await act(async () => { render(<ChatInbox initial={[rooms[0]]} userId="admin" tenant />); });
  const reads = vi.mocked(markChatRead).mock.calls.length;
  await act(async () => receive({ data: JSON.stringify({ type: 'conversation.read', conversation_id: rooms[0].id, user_id: 'admin' }) }));
  expect(markChatRead).toHaveBeenCalledTimes(reads);
});
it('retains a delayed failed delivery through concurrent poll, unavailable read and recovery', async () => {
  let finish!: (value: { data: null; error: string; reason: 'unavailable' }) => void;
  vi.mocked(sendChatMessage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { render(<ChatInbox initial={[rooms[0]]} userId="admin" tenant />); });
  await act(async () => {
    fireEvent.change(screen.getByRole('textbox', { name: 'Pesan' }), { target: { value: 'Keep my retry' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kirim' }));
  });
  const key = vi.mocked(sendChatMessage).mock.calls[0][2];
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  await act(async () => finish({ data: null, error: 'Unavailable', reason: 'unavailable' }));
  expect(screen.getByRole('button', { name: /Gagal dikirim/ })).toBeTruthy();
  vi.mocked(listChatConversations).mockResolvedValue({ data: null, error: 'Unavailable', reason: 'unavailable' });
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(screen.queryByText('Keep my retry')).toBeNull();
  vi.mocked(listChatConversations).mockResolvedValue({ data: [rooms[0]], error: null });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Muat ulang' })); });
  vi.mocked(sendChatMessage).mockResolvedValue({ data: { ...message(rooms[0].id), sender_user_id: 'admin', body: 'Keep my retry', client_message_id: key }, error: null });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Gagal dikirim/ })); });
  expect(vi.mocked(sendChatMessage).mock.calls[1][2]).toBe(key);
  expect(screen.queryByRole('button', { name: /Gagal dikirim/ })).toBeNull();
});
