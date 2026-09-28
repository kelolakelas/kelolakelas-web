'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { applyChatEvent, chatTitle, chatWebSocketUrl, mergeMessages, senderLabel, updateDelivery, type ChatConversation, type ChatEvent, type ChatMessage } from '@/lib/chat';
import { createStaffChat, issueChatTicket, listChatConversations, listChatMessages, markChatRead, sendChatMessage } from '@/lib/chat-actions';

type Connection = 'connecting' | 'connected' | 'disconnected';

export function ChatInbox({ initial, userId, tenant }: { initial: ChatConversation[]; userId: string; tenant: boolean }) {
  const [conversations, setConversations] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id || null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [older, setOlder] = useState<Record<string, boolean>>({});
  const [connection, setConnection] = useState<Connection>(() => chatWebSocketUrl(process.env.NEXT_PUBLIC_CHAT_WS_URL, 'probe') && typeof WebSocket !== 'undefined' ? 'connecting' : 'disconnected');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const activeRef = useRef(activeId);
  useEffect(() => { activeRef.current = activeId; }, [activeId]);

  const refresh = useCallback(async (id?: string | null) => {
    const [list, items] = await Promise.all([listChatConversations(), id ? listChatMessages(id) : Promise.resolve(null)]);
    if (list.error) setError(list.error);
    else if (list.data) setConversations(list.data);
    if (id && items) {
      if (items.error) setError(items.error);
      else if (items.data) {
        setMessages((previous) => ({ ...previous, [id]: mergeMessages(previous[id] || [], items.data) }));
        setOlder((previous) => ({ ...previous, [id]: items.data.length === 100 }));
      }
    }
    if (!list.error && list.data && (!id || (items && !items.error && items.data))) setError('');
  }, []);

  const select = useCallback(async (id: string) => {
    activeRef.current = id;
    setActiveId(id);
    const result = await listChatMessages(id);
    if (result.error) setError(result.error);
    else if (result.data) {
      setMessages((previous) => ({ ...previous, [id]: mergeMessages(previous[id] || [], result.data) }));
      setOlder((previous) => ({ ...previous, [id]: result.data.length === 100 }));
    }
    const read = await markChatRead(id);
    if (read.error) setError(read.error);
    else setConversations((previous) => previous.map((c) => c.id === id ? { ...c, unread_count: 0 } : c));
  }, []);

  useEffect(() => {
    if (activeRef.current) {
      const id = activeRef.current;
      void listChatMessages(id).then((result) => {
        if (result.error) setError(result.error);
        else if (result.data) {
          setMessages((previous) => ({ ...previous, [id]: mergeMessages(previous[id] || [], result.data) }));
          setOlder((previous) => ({ ...previous, [id]: result.data.length === 100 }));
        }
      });
      void markChatRead(id).then((result) => {
        if (!result.error) setConversations((previous) => previous.map((c) => c.id === id ? { ...c, unread_count: 0 } : c));
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
    if (!chatWebSocketUrl(base, 'probe') || typeof WebSocket === 'undefined') return;
    let stopped = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let socket: WebSocket | undefined;
    async function connect() {
      setConnection('connecting');
      const ticket = await issueChatTicket();
      if (stopped) return;
      const url = ticket.data?.ticket && chatWebSocketUrl(base, ticket.data.ticket);
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
            if (event.type !== 'message.created' && event.type !== 'conversation.read') return;
            if (event.type === 'message.created' && event.message?.conversation_id === event.conversation_id) {
              setMessages((previous) => ({ ...previous, [event.conversation_id]: mergeMessages(previous[event.conversation_id] || [], [event.message]) }));
              if (activeRef.current === event.conversation_id && event.message.sender_user_id !== userId) void markChatRead(event.conversation_id);
            }
            // Refresh the list to discover conversations created since connect.
            void refresh(activeRef.current);
            setConversations((previous) => applyChatEvent(previous, event, userId, activeRef.current));
          } catch { /* Ignore malformed frames and keep the connection alive. */ }
        };
        socket.onclose = () => { if (!stopped) { setConnection('disconnected'); schedule(); } };
        socket.onerror = () => { socket?.close(); };
      } catch { setConnection('disconnected'); schedule(); }
    }
    function schedule() {
      if (!stopped) timer = setTimeout(() => { void connect(); }, Math.min(1000 * 2 ** retry++, 30000));
    }
    void connect();
    return () => { stopped = true; if (timer) clearTimeout(timer); socket?.close(); };
  }, [refresh, userId]);

  async function startStaff() {
    setBusy(true);
    const result = await createStaffChat();
    setBusy(false);
    if (result.error || !result.data) { setError(result.error || 'Layanan chat sedang tidak tersedia.'); return; }
    const conversation = result.data;
    setConversations((previous) => [conversation, ...previous.filter((c) => c.id !== conversation.id)]);
    void select(conversation.id);
  }

  async function deliver(id: string, body: string, clientId: string) {
    const result = await sendChatMessage(id, body, clientId);
    if (result.error) {
      setError(result.error);
      setMessages((previous) => ({ ...previous, [id]: updateDelivery(previous[id] || [], clientId, 'failed') }));
    } else if (result.data) {
      const confirmed = result.data;
      setError('');
      setMessages((previous) => ({ ...previous, [id]: mergeMessages(previous[id] || [], [confirmed]) }));
      void refresh(id);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeId || !draft.trim() || [...draft.trim()].length > 2000) return;
    const body = draft.trim();
    const clientId = crypto.randomUUID();
    const optimistic: ChatMessage = { id: clientId, conversation_id: activeId, sender_user_id: userId, sender_kind: tenant ? 'tenant' : 'parent', body, client_message_id: clientId, created_at: new Date().toISOString(), delivery: 'sending' };
    setMessages((previous) => ({ ...previous, [activeId]: mergeMessages(previous[activeId] || [], [optimistic]) }));
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
      setMessages((previous) => ({ ...previous, [id]: mergeMessages(previous[id] || [], result.data) }));
      setOlder((previous) => ({ ...previous, [id]: result.data.length === 100 }));
    }
  }

  function retry(message: ChatMessage) {
    if (!activeId || message.delivery !== 'failed') return;
    setMessages((previous) => ({ ...previous, [activeId]: updateDelivery(previous[activeId] || [], message.client_message_id, 'sending') }));
    void deliver(activeId, message.body, message.client_message_id);
  }

  const active = conversations.find((c) => c.id === activeId);
  return <section aria-label="Chat inbox" className="grid gap-5 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Percakapan</h2>{tenant && <button type="button" disabled={busy} onClick={() => void startStaff()} className="rounded-lg bg-[#17231f] px-3 py-2 text-sm text-white disabled:opacity-50">Mulai chat admin</button>}</div>
      {conversations.length === 0 && <p className="mt-5 text-sm text-gray-600">Belum ada percakapan.</p>}
      <ul className="mt-4 space-y-2">{conversations.map((conversation) => <li key={conversation.id}><button type="button" aria-current={activeId === conversation.id ? 'true' : undefined} onClick={() => void select(conversation.id)} className="w-full rounded-xl border border-gray-200 p-3 text-left hover:bg-gray-50"><span className="font-semibold">{chatTitle(conversation)}</span>{conversation.unread_count > 0 && <span className="ml-2 rounded-full bg-green-100 px-2 text-sm">{conversation.unread_count} belum dibaca</span>}<span className="block truncate text-sm text-gray-600">{conversation.last_message?.body || 'Belum ada pesan'}</span></button></li>)}</ul>
    </div>
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 border-b pb-3"><div><h2 className="font-bold">{active ? chatTitle(active) : 'Pilih percakapan'}</h2><p role="status" className="text-sm text-gray-600">{connection === 'connected' ? 'Terhubung' : connection === 'connecting' ? 'Menghubungkan…' : 'Terputus — pesan tetap dapat dikirim dan dimuat manual'}</p></div><button type="button" onClick={() => void refresh(activeRef.current)} className="rounded-lg border px-3 py-2 text-sm">Muat ulang</button></div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {activeId && older[activeId] && <button type="button" onClick={() => void loadOlder()} className="mt-3 text-sm font-semibold text-green-800">Muat pesan lama</button>}
      <ol aria-label="Pesan" className="my-4 max-h-[55vh] min-h-64 space-y-3 overflow-y-auto">{(activeId ? messages[activeId] || [] : []).map((message) => <li key={message.id} className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-bold text-gray-600">{senderLabel(message, userId)}</p><p className="whitespace-pre-wrap break-words">{message.body}</p>{message.delivery === 'sending' && <p className="text-xs">Mengirim…</p>}{message.delivery === 'failed' && <button type="button" onClick={() => retry(message)} className="text-xs font-semibold text-red-700">Gagal dikirim — Coba lagi</button>}</li>)}</ol>
      {active && <form onSubmit={submit} className="flex gap-2"><label htmlFor="chat-message" className="sr-only">Pesan</label><textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} className="min-w-0 flex-1 rounded-lg border p-2" placeholder="Tulis pesan" /><button type="submit" disabled={!draft.trim()} className="rounded-lg bg-[#17231f] px-4 text-white disabled:opacity-50">Kirim</button></form>}
    </div>
  </section>;
}
