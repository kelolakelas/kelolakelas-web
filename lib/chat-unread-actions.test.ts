import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./chat-actions', () => ({ listChatConversations: vi.fn() }));
vi.mock('./chat-unread-scope', () => ({ readChatUnreadScope: vi.fn(async () => 'scope-a') }));
import { listChatConversations } from './chat-actions';
import { readChatUnreadScope } from './chat-unread-scope';
import { readChatUnreadCount } from './chat-unread-actions';
const page = (count: number, prefix = 'a') => Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}`, unread_count: 0 }));
beforeEach(() => { vi.resetAllMocks(); vi.mocked(readChatUnreadScope).mockResolvedValue('scope-a'); });
function answer(rows: unknown[]) { return { data: rows, error: null } as Awaited<ReturnType<typeof listChatConversations>>; }
describe('navigation unread authoritative pagination', () => {
  it('reaches unread beyond first 100 read conversations', async () => {
    vi.mocked(listChatConversations).mockResolvedValueOnce(answer(page(100))).mockResolvedValueOnce(answer([{ id: 'older', unread_count: 7 }]));
    expect(await readChatUnreadCount('scope-a')).toEqual({ count: 7 });
    expect(vi.mocked(listChatConversations).mock.calls).toEqual([[1], [2]]);
  });
  it.each([0, 1, 99, 100, 150])('caps %i messages, rather than counting conversations', async (count) => {
    vi.mocked(listChatConversations).mockResolvedValue(answer([{ id: 'c', unread_count: count }]));
    expect(await readChatUnreadCount('scope-a')).toEqual({ count: Math.min(count, 100) });
  });
  it('stops at display cap without fetching unnecessary pages', async () => {
    vi.mocked(listChatConversations).mockResolvedValue(answer(page(100).map(row => ({ ...row, unread_count: 1 }))));
    expect(await readChatUnreadCount('scope-a')).toEqual({ count: 100 });
    expect(listChatConversations).toHaveBeenCalledTimes(1);
  });
  it('deduplicates conversations reordered between pages', async () => {
    const rows = page(100); rows[0].unread_count = 4;
    vi.mocked(listChatConversations).mockResolvedValueOnce(answer(rows)).mockResolvedValueOnce(answer([rows[0], { id: 'older', unread_count: 3 }]));
    expect(await readChatUnreadCount('scope-a')).toEqual({ count: 7 });
  });
  it('returns unknown on partial failure or malformed/repeated full pages', async () => {
    vi.mocked(listChatConversations).mockResolvedValueOnce(answer(page(100))).mockResolvedValueOnce({ data: null, error: 'Unavailable' });
    expect(await readChatUnreadCount('scope-a')).toEqual({ count: null });
    vi.mocked(listChatConversations).mockResolvedValue(answer([{ id: 'c', unread_count: -1 }]));
    expect(await readChatUnreadCount('scope-a')).toEqual({ count: null });
    vi.mocked(listChatConversations).mockResolvedValue(answer(page(100)));
    expect(await readChatUnreadCount('scope-a')).toEqual({ count: null });
  });
  it('rejects old-session/tenant scope before any fetch', async () => {
    expect(await readChatUnreadCount('scope-b')).toEqual({ count: null });
    expect(listChatConversations).not.toHaveBeenCalled();
  });
});
