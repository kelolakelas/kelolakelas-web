// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/parent/students' }));
vi.mock('@/lib/chat-unread-actions', () => ({ readChatUnreadCount: vi.fn() }));
import { readChatUnreadCount } from '@/lib/chat-unread-actions';
import { CHAT_UNREAD_REFRESH } from '@/lib/chat-unread-events';
import { ChatUnreadProvider, useChatUnreadCount } from './ChatUnreadProvider';
import { NavigationBadge } from './NavigationBadge';
function Consumer() { return <NavigationBadge count={useChatUnreadCount()} />; }
const view = (scope: string, enabled = true) => <ChatUnreadProvider scope={scope} enabled={enabled}><Consumer /></ChatUnreadProvider>;
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('BroadcastChannel', undefined); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('navigation badge', () => {
  it.each([0, 1, 99, 100, 140, null])('renders boundary %s accessibly', (count) => {
    const { container } = render(<NavigationBadge count={count} />);
    if (count === 0) expect(container.textContent).toBe('');
    else { expect(container.textContent).toBe(count === null ? '…' : count >= 100 ? '99+' : String(count)); expect(container.firstElementChild?.getAttribute('aria-label')).toContain('pesan belum dibaca'); }
  });
});
describe('shared reconciliation', () => {
  it('uses authoritative values for duplicate events and failed reads', async () => {
    vi.mocked(readChatUnreadCount).mockResolvedValue({ count: 3 });
    render(view('a'));
    await screen.findByLabelText('3 pesan belum dibaca');
    await act(async () => { window.dispatchEvent(new Event(CHAT_UNREAD_REFRESH)); window.dispatchEvent(new Event(CHAT_UNREAD_REFRESH)); });
    expect(screen.getByLabelText('3 pesan belum dibaca')).toBeTruthy();
    vi.mocked(readChatUnreadCount).mockResolvedValue({ count: null });
    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(screen.getByLabelText('Jumlah pesan belum dibaca belum tersedia')).toBeTruthy();
    vi.mocked(readChatUnreadCount).mockResolvedValue({ count: 0 });
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(screen.queryByText('…')).toBeNull();
  });
  it('discards a delayed prior account response and hides counts without nav permission', async () => {
    let finish!: (value: { count: number }) => void;
    vi.mocked(readChatUnreadCount).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ count: 2 });
    const { rerender } = render(view('a'));
    rerender(view('b'));
    await screen.findByLabelText('2 pesan belum dibaca');
    await act(async () => finish({ count: 90 }));
    expect(screen.queryByText('90')).toBeNull();
    rerender(view('b', false));
    await waitFor(() => expect(readChatUnreadCount).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('2')).toBeNull();
  });
  it('reconciles cross-tab invalidation and queues a read arriving during an in-flight refresh', async () => {
    let receive!: () => void;
    class Channel {
      set onmessage(callback: () => void) { receive = callback; }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', Channel);
    let finish!: (value: { count: number }) => void;
    vi.mocked(readChatUnreadCount).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ count: 0 });
    render(view('a'));
    await act(async () => receive());
    await act(async () => finish({ count: 1 }));
    expect(readChatUnreadCount).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('1')).toBeNull();
  });

  it('keeps polling when browser policy refuses BroadcastChannel', async () => {
    vi.stubGlobal('BroadcastChannel', class { constructor() { throw new Error('Denied'); } });
    vi.mocked(readChatUnreadCount).mockResolvedValue({ count: 4 });
    render(view('a'));
    expect(await screen.findByLabelText('4 pesan belum dibaca')).toBeTruthy();
  });

  it('reconciles outside inbox every ten seconds without incrementing local counters', async () => {
    vi.useFakeTimers();
    vi.mocked(readChatUnreadCount).mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 2 });
    render(view('a'));
    await act(async () => {});
    expect(screen.getByText('1')).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(screen.getByText('2')).toBeTruthy();
  });
});
