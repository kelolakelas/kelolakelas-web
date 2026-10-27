'use client';

import { notifyChatUnreadChanged } from '@/lib/chat-unread-events';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { BellRing } from 'lucide-react';
import {
  chatTitle,
  chatWebSocketUrl,
  conversationTenantLabel,
  isNotificationConversation,
  isSystemMessage,
  mergeMessages,
  senderLabel,
  updateDelivery,
  type ChatConversation,
  type ChatEvent,
  type ChatMessage,
} from '@/lib/chat';
import {
  createStaffChat,
  getChatConversation,
  issueChatTicket,
  listChatConversations,
  listChatMessages,
  markChatRead,
  sendChatMessage,
} from '@/lib/chat-actions';

type Connection = 'connecting' | 'connected' | 'disconnected';
function pendingMessages(previous: Record<string, ChatMessage[]>) {
  return Object.fromEntries(Object.entries(previous).map(([id, items]) => [id, items.filter(item => item.delivery)]));
}

interface InboxProps {
  initial: ChatConversation[];
  userId: string;
  tenant: boolean;
  initialConversationId?: string | null;
  scope?: string | null;
}
export function ChatInbox(props: InboxProps) {
  return <ScopedChatInbox key={`${props.scope || props.userId}:${props.tenant}:${props.initialConversationId || ''}`} {...props} />;
}
function ScopedChatInbox({ initial, userId, tenant, initialConversationId }: InboxProps) {
  const [conversations, setConversations] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversationId || initial[0]?.id || null
  );
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>(() => {
    const id = initialConversationId || initial[0]?.id;
    return id ? { [id]: true } : {};
  });
  const [older, setOlder] = useState<Record<string, boolean>>({});
  const [connection, setConnection] = useState<Connection>(() =>
    chatWebSocketUrl(process.env.NEXT_PUBLIC_CHAT_WS_URL, 'probe') &&
    typeof WebSocket !== 'undefined'
      ? 'connecting'
      : 'disconnected'
  );
  const [error, setError] = useState('');
  const errorSerial = useRef(0);
  const reportError = useCallback((message: string) => {
    if (message) errorSerial.current++;
    setError(message);
  }, []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const activeRef = useRef(activeId);
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  const mounted = useRef(false);
  const version = useRef(0);
  const selectionVersion = useRef(0);
  const pages = useRef(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(initial.length === 100);
  const [refreshing, setRefreshing] = useState(false);

  // Every read path (selection, poll, refresh, paging and reconnect) revalidates
  // the selected room. Only the latest request in this mounted context commits.
  const refresh = useCallback(async (id?: string | null, pageCount = pages.current, readList = true, markSelectedRead = true) => {
    // Reserve the user's paging intent before awaiting: a reconnect/poll that
    // starts during Load more must refresh that expanded window too.
    if (readList) { pages.current = Math.max(pages.current, pageCount); pageCount = pages.current; }
    const request = ++version.current;
    const startingError = errorSerial.current;
    const current = () => mounted.current && request === version.current;
    if (readList) setRefreshing(true);
    try {
      const [lists, direct, items] = await Promise.all([
        readList ? Promise.all(Array.from({ length: pageCount }, (_, i) => listChatConversations(i + 1))) : Promise.resolve(null),
        id ? getChatConversation(id) : Promise.resolve(null),
        id ? listChatMessages(id) : Promise.resolve(null),
      ]);
      if (!current()) return;
      const failedList = lists?.find(result => result.error);
      if (failedList?.error) {
        setConversations([]); setMessages(previous => failedList.reason === 'denied' ? {} : pendingMessages(previous)); reportError(failedList.error);
        if (failedList.reason === 'denied') { activeRef.current = null; setActiveId(null); }
        return;
      }
      const seen = new Set<string>();
      const next = lists?.flatMap(result => result.data || []).filter(room => {
        if (seen.has(room.id)) return false;
        seen.add(room.id); return true;
      });
      if (lists) {
        pages.current = pageCount;
        setHasMoreConversations((lists.at(-1)?.data?.length || 0) === 100);
      }
      if (id && (direct?.error || direct?.data?.id !== id || items?.error)) {
        const problem = direct?.error ? direct : items?.error ? items : null;
        if (next) setConversations(next.filter(room => room.id !== id));
        else setConversations(previous => previous.filter(room => room.id !== id));
        setMessages(previous => { const copy = { ...previous }; if (problem?.reason === 'unavailable') copy[id] = (copy[id] || []).filter(item => item.delivery); else delete copy[id]; return copy; });
        reportError(problem?.error || 'Percakapan tidak ditemukan.');
        if (problem?.reason === 'denied' || (!direct?.error && direct?.data?.id !== id)) {
          activeRef.current = null; setActiveId(null);
        }
        return;
      }
      if (next) {
        if (direct?.data && !next.some(room => room.id === direct.data.id)) next.push(direct.data);
        setConversations(next);
      } else if (direct?.data) {
        const room = direct.data;
        setConversations(previous => previous.some(item => item.id === room.id) ? previous : [...previous, room]);
      }
      if (id && items?.data) {
        setMessages(previous => ({ ...previous, [id]: mergeMessages(previous[id] || [], items.data) }));
        setOlder(previous => ({ ...previous, [id]: items.data.length === 100 }));
        if (markSelectedRead) {
          const read = await markChatRead(id);
          if (!current()) return;
          if (read.error) {
            setMessages(previous => read.reason === 'denied' ? {} : pendingMessages(previous)); setConversations([]); reportError(read.error);
            if (read.reason === 'denied') { activeRef.current = null; setActiveId(null); }
            return;
          }
          notifyChatUnreadChanged();
          setConversations(previous => previous.map(room => room.id === id ? { ...room, unread_count: 0 } : room));
        }
      }
      if (errorSerial.current === startingError) reportError('');
    } catch {
      if (current()) { setConversations([]); setMessages(pendingMessages); reportError('Layanan chat sedang tidak tersedia. Coba lagi nanti.'); }
    } finally {
      if (current()) {
        setRefreshing(false);
        if (id) setLoading(previous => ({ ...previous, [id]: false }));
      }
    }
  }, [reportError]);

  const select = useCallback(async (id: string) => {
    selectionVersion.current++;
    activeRef.current = id; setActiveId(id);
    if (window.location.pathname.endsWith('/chat')) {
      const url = new URL(window.location.href);
      url.searchParams.set('conversation', id);
      window.history.replaceState(window.history.state, '', url);
    }
    setLoading(previous => ({ ...previous, [id]: true }));
    await refresh(id, pages.current, false);
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    if (activeRef.current) void select(activeRef.current);
    const reconcile = () => { if (document.visibilityState !== 'hidden') void refresh(activeRef.current); };
    const timer = setInterval(reconcile, 10000);
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', reconcile);
    return () => {
      mounted.current = false;
      clearInterval(timer); window.removeEventListener('focus', reconcile);
      document.removeEventListener('visibilitychange', reconcile);
    };
  }, [refresh, select]);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_CHAT_WS_URL;
    if (!chatWebSocketUrl(base, 'probe') || typeof WebSocket === 'undefined')
      return;
    let stopped = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;
    async function connect() {
      setConnection('connecting');
      const ticket = await issueChatTicket();
      if (stopped) return;
      const url =
        ticket.data?.ticket && chatWebSocketUrl(base, ticket.data.ticket);
      if (!url) {
        setConnection('disconnected');
        schedule();
        return;
      }
      try {
        socket = new WebSocket(url);
        socket.onopen = () => {
          retry = 0;
          notifyChatUnreadChanged();
          setConnection('connected');
          void refresh(activeRef.current);
        };
        socket.onmessage = (message) => {
          try {
            const event = JSON.parse(message.data) as ChatEvent;
            if (event.type !== 'message.created' && event.type !== 'conversation.read') return;
            // Frames trigger an authoritative REST read. Never reinsert a room
            // or message from a connection whose rights snapshot may be stale.
            notifyChatUnreadChanged();
            void refresh(activeRef.current, pages.current, true, event.type === 'message.created');
          } catch { /* Ignore malformed frames. */ }
        };
        socket.onclose = () => {
          if (!stopped) {
            setConnection('disconnected');
            schedule();
          }
        };
        socket.onerror = () => {
          socket?.close();
        };
      } catch {
        setConnection('disconnected');
        schedule();
      }
    }
    function schedule() {
      if (!stopped)
        timer = setTimeout(
          () => {
            void connect();
          },
          Math.min(1000 * 2 ** retry++, 30000)
        );
    }
    void connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [refresh, userId]);

  async function startStaff() {
    setBusy(true);
    const result = await createStaffChat();
    setBusy(false);
    if (result.error || !result.data) {
      reportError(result.error || 'Layanan chat sedang tidak tersedia.');
      return;
    }
    const conversation = result.data;
    setConversations((previous) => [
      conversation,
      ...previous.filter((c) => c.id !== conversation.id),
    ]);
    void select(conversation.id);
  }

  async function deliver(id: string, body: string, clientId: string) {
    // A poll may finish while the send is pending. Only a changed selection or
    // context invalidates its delivery result; keep the original retry key.
    const generation = selectionVersion.current;
    const result = await sendChatMessage(id, body, clientId);
    if (!mounted.current || activeRef.current !== id || generation !== selectionVersion.current) return;
    if (result.error) {
      reportError(result.error);
      if (result.reason === 'denied') { setConversations([]); setMessages({}); activeRef.current = null; setActiveId(null); return; }
      setMessages((previous) => ({
        ...previous,
        [id]: updateDelivery(previous[id] || [], clientId, 'failed'),
      }));
    } else if (result.data) {
      const confirmed = result.data;
      reportError('');
      setMessages((previous) => ({
        ...previous,
        [id]: mergeMessages(previous[id] || [], [confirmed]),
      }));
      void refresh(id);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !draft.trim() || [...draft.trim()].length > 2000) return;
    const body = draft.trim();
    const clientId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: clientId,
      conversation_id: activeId,
      sender_user_id: userId,
      sender_kind: tenant ? 'tenant' : 'parent',
      body,
      client_message_id: clientId,
      created_at: new Date().toISOString(),
      delivery: 'sending',
    };
    setMessages((previous) => ({
      ...previous,
      [activeId]: mergeMessages(previous[activeId] || [], [optimistic]),
    }));
    setDraft('');
    void deliver(activeId, body, clientId);
  }

  async function loadOlder() {
    if (!activeId) return;
    const oldest = messages[activeId]?.find((message) => !message.delivery);
    if (!oldest) return;
    const id = activeId;
    const generation = version.current;
    const result = await listChatMessages(id, oldest.id);
    if (!mounted.current || activeRef.current !== id || generation !== version.current) return;
    if (result.error) {
      reportError(result.error);
      setConversations([]);
      setMessages(previous => result.reason === 'denied' ? {} : pendingMessages(previous));
      if (result.reason === 'denied') { activeRef.current = null; setActiveId(null); }
    } else if (result.data) {
      setMessages((previous) => ({
        ...previous,
        [id]: mergeMessages(previous[id] || [], result.data),
      }));
      setOlder((previous) => ({
        ...previous,
        [id]: result.data.length === 100,
      }));
    }
  }

  function retry(message: ChatMessage) {
    if (!activeId || message.delivery !== 'failed') return;
    setMessages((previous) => ({
      ...previous,
      [activeId]: updateDelivery(
        previous[activeId] || [],
        message.client_message_id,
        'sending'
      ),
    }));
    void deliver(activeId, message.body, message.client_message_id);
  }

  const active = conversations.find((c) => c.id === activeId);
  const activeMessages = active && activeId && !loading[activeId] ? messages[activeId] || [] : [];
  const loadingMessages = Boolean(activeId && loading[activeId]);
  const buttonClass =
    'min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800';

  return (
    <section
      aria-label="Chat inbox"
      className="grid min-w-0 gap-4 text-gray-900 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] dark:text-gray-100"
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:h-[min(42rem,calc(100dvh-9rem))] lg:min-h-80 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
          <h2 className="text-lg font-bold">Percakapan</h2>
          {tenant && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void startStaff()}
              className="min-h-11 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
            >
              {busy ? 'Membuka…' : 'Mulai chat admin'}
            </button>
          )}
        </div>
        {conversations.length === 0 && !error && !refreshing && (
          <p className="p-5 text-sm text-gray-600 dark:text-gray-400">
            Belum ada percakapan. Percakapan baru akan tampil di sini.
          </p>
        )}
        <ul
          aria-label="Daftar percakapan"
          className="min-h-0 max-h-60 space-y-2 overflow-y-auto overscroll-contain p-3 lg:max-h-none lg:flex-1"
        >
          {conversations.map((conversation) => {
            const notification = isNotificationConversation(conversation);
            const tenantLabel = conversationTenantLabel(conversation);
            const selected = activeId === conversation.id;
            return (
              <li key={conversation.id} className="min-w-0">
                <button
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => void select(conversation.id)}
                  className={`w-full min-w-0 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${selected ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800'}`}
                >
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    {notification && (
                      <BellRing
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-green-800 dark:text-green-300"
                      />
                    )}
                    <span className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]">
                      {chatTitle(conversation)}
                    </span>
                  </span>
                  {tenantLabel && (
                    <span className="mt-2 inline-block max-w-full rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-900 [overflow-wrap:anywhere] dark:bg-green-950 dark:text-green-200">
                      {tenantLabel}
                    </span>
                  )}
                  {conversation.unread_count > 0 && (
                    <span className="mt-2 inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900 dark:bg-blue-900 dark:text-blue-100">
                      {conversation.unread_count} belum dibaca
                    </span>
                  )}
                  <span className="mt-1 block truncate text-sm text-gray-600 dark:text-gray-400">
                    {conversation.last_message?.body || 'Belum ada pesan'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {hasMoreConversations && <div className="border-t border-gray-200 p-3 dark:border-gray-800">
          <button type="button" disabled={refreshing} aria-busy={refreshing} className={buttonClass}
            onClick={() => { void refresh(activeRef.current, pages.current + 1); }}>
            Muat percakapan lebih lama
          </button>
        </div>}

      </div>

      <section
        aria-label="Percakapan aktif"
        className="flex h-[min(42rem,calc(100dvh-9rem))] min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 font-bold [overflow-wrap:anywhere]">
              {active ? chatTitle(active) : 'Pilih percakapan'}
            </h2>
            <p
              role="status"
              aria-label="Koneksi chat"
              className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400"
            >
              {connection === 'connected'
                ? 'Terhubung'
                : connection === 'connecting'
                  ? 'Menghubungkan…'
                  : 'Terputus — pesan tetap dapat dikirim dan dimuat manual'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh(activeRef.current)}
            className={buttonClass}
          >
            Muat ulang
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mx-4 mt-3 shrink-0 rounded-lg bg-red-50 p-3 text-sm text-red-800 [overflow-wrap:anywhere] dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        )}
        {activeId && older[activeId] && (
          <button
            type="button"
            onClick={() => void loadOlder()}
            className={`mx-4 mt-3 shrink-0 self-start ${buttonClass}`}
          >
            Muat pesan lama
          </button>
        )}
        <ol
          aria-label="Pesan"
          aria-busy={loadingMessages}
          tabIndex={0}
          className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
        >
          {loadingMessages && activeMessages.length === 0 ? (
            <li
              role="status"
              className="py-8 text-center text-sm text-gray-600 dark:text-gray-400"
            >
              Memuat pesan…
            </li>
          ) : (
            activeMessages.length === 0 && (
              <li className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">
                {active
                  ? isNotificationConversation(active)
                    ? 'Belum ada notifikasi.'
                    : 'Belum ada pesan. Mulai percakapan di bawah.'
                  : 'Pilih percakapan untuk membaca pesan.'}
              </li>
            )
          )}
          {activeMessages.map((message) => {
            const system = isSystemMessage(message);
            const own = message.sender_user_id === userId;
            return (
              <li
                key={message.id}
                className={`w-fit min-w-0 max-w-[95%] rounded-xl border p-3 sm:max-w-[85%] ${system ? 'mx-auto border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950' : own ? 'ml-auto border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}`}
              >
                <p className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
                  {senderLabel(message, userId)}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                  {message.body}
                </p>
                {message.delivery === 'sending' && (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    Mengirim…
                  </p>
                )}
                {message.delivery === 'failed' && (
                  <button
                    type="button"
                    onClick={() => retry(message)}
                    className="mt-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-red-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-red-300"
                  >
                    Gagal dikirim — Coba lagi
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        {active &&
          (isNotificationConversation(active) ? (
            <p className="shrink-0 border-t border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300">
              Percakapan notifikasi bersifat satu arah — pesan sistem hanya
              dapat dibaca.
            </p>
          ) : (
            <form
              onSubmit={submit}
              className="flex shrink-0 flex-wrap items-end gap-2 border-t border-gray-200 p-3 sm:p-4 dark:border-gray-800"
            >
              <div className="min-w-0 flex-1 basis-40">
                <label
                  htmlFor="chat-message"
                  className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400"
                >
                  Pesan
                </label>
                <textarea
                  id="chat-message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  className="block max-h-32 min-h-11 w-full resize-y rounded-lg border border-gray-300 bg-white p-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-gray-600 dark:bg-gray-950"
                  placeholder="Tulis pesan"
                />
              </div>
              <button
                type="submit"
                disabled={!draft.trim()}
                className="min-h-11 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Kirim
              </button>
            </form>
          ))}
      </section>
    </section>
  );
}
