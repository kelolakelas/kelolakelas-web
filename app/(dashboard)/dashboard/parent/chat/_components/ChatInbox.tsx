'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { BellRing } from 'lucide-react';
import {
  applyChatEvent,
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

export function ChatInbox({
  initial,
  userId,
  tenant,
  initialConversationId,
}: {
  initial: ChatConversation[];
  userId: string;
  tenant: boolean;
  initialConversationId?: string | null;
}) {
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
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const activeRef = useRef(activeId);
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  const refresh = useCallback(async (id?: string | null) => {
    const [list, items] = await Promise.all([
      listChatConversations(),
      id ? listChatMessages(id) : Promise.resolve(null),
    ]);
    if (list.error) setError(list.error);
    // A deep-linked conversation may be missing from the first list read
    // (e.g. just created): fetch it directly so the entry button's landing
    // target is selectable rather than silently defaulting elsewhere.
    else if (list.data) {
      setConversations(list.data);
      if (id && !list.data.some((c) => c.id === id)) {
        const direct = await getChatConversation(id);
        if (!direct.error && direct.data) {
          const conversation = direct.data;
          setConversations((previous) =>
            previous.some((c) => c.id === conversation.id)
              ? previous
              : [conversation, ...previous]
          );
        }
      }
    }
    if (id && items) {
      if (items.error) setError(items.error);
      else if (items.data) {
        setMessages((previous) => ({
          ...previous,
          [id]: mergeMessages(previous[id] || [], items.data),
        }));
        setOlder((previous) => ({
          ...previous,
          [id]: items.data.length === 100,
        }));
      }
    }
    if (
      !list.error &&
      list.data &&
      (!id || (items && !items.error && items.data))
    )
      setError('');
  }, []);

  const select = useCallback(async (id: string) => {
    activeRef.current = id;
    setActiveId(id);
    setLoading((previous) => ({ ...previous, [id]: true }));
    const result = await listChatMessages(id);
    if (result.error) setError(result.error);
    else if (result.data) {
      setMessages((previous) => ({
        ...previous,
        [id]: mergeMessages(previous[id] || [], result.data),
      }));
      setOlder((previous) => ({
        ...previous,
        [id]: result.data.length === 100,
      }));
    }
    setLoading((previous) => ({ ...previous, [id]: false }));
    const read = await markChatRead(id);
    if (read.error) setError(read.error);
    else
      setConversations((previous) =>
        previous.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
      );
  }, []);

  useEffect(() => {
    if (activeRef.current) {
      const id = activeRef.current;
      void listChatMessages(id).then((result) => {
        setLoading((previous) => ({ ...previous, [id]: false }));
        if (result.error) setError(result.error);
        else if (result.data) {
          setMessages((previous) => ({
            ...previous,
            [id]: mergeMessages(previous[id] || [], result.data),
          }));
          setOlder((previous) => ({
            ...previous,
            [id]: result.data.length === 100,
          }));
        }
      });
      void markChatRead(id).then((result) => {
        if (!result.error)
          setConversations((previous) =>
            previous.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
          );
      });
    }
  }, []);

  // Conversation creation has no WS event; periodically reconcile the list so
  // an admin sees a newly opened (still empty) staff conversation.
  useEffect(() => {
    const timer = setInterval(() => {
      void listChatConversations().then((result) => {
        if (result.data) setConversations(result.data);
      });
    }, 10000);
    return () => clearInterval(timer);
  }, []);

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
          setConnection('connected');
          setError('');
          void refresh(activeRef.current);
        };
        socket.onmessage = (message) => {
          try {
            const event = JSON.parse(message.data) as ChatEvent;
            if (
              event.type !== 'message.created' &&
              event.type !== 'conversation.read'
            )
              return;
            if (
              event.type === 'message.created' &&
              event.message?.conversation_id === event.conversation_id
            ) {
              setMessages((previous) => ({
                ...previous,
                [event.conversation_id]: mergeMessages(
                  previous[event.conversation_id] || [],
                  [event.message]
                ),
              }));
              if (
                activeRef.current === event.conversation_id &&
                event.message.sender_user_id !== userId
              )
                void markChatRead(event.conversation_id);
            }
            // Refresh the list to discover conversations created since connect.
            void refresh(activeRef.current);
            setConversations((previous) =>
              applyChatEvent(previous, event, userId, activeRef.current)
            );
          } catch {
            /* Ignore malformed frames and keep the connection alive. */
          }
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
      setError(result.error || 'Layanan chat sedang tidak tersedia.');
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
    const result = await sendChatMessage(id, body, clientId);
    if (result.error) {
      setError(result.error);
      setMessages((previous) => ({
        ...previous,
        [id]: updateDelivery(previous[id] || [], clientId, 'failed'),
      }));
    } else if (result.data) {
      const confirmed = result.data;
      setError('');
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
    const result = await listChatMessages(id, oldest.id);
    if (result.error) setError(result.error);
    else if (result.data) {
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
  const activeMessages = activeId ? messages[activeId] || [] : [];
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
        {conversations.length === 0 && (
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
