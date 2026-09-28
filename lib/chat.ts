export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  sender_kind: string;
  body: string;
  client_message_id: string;
  created_at: string;
  delivery?: 'sending' | 'failed';
}

export interface ChatConversation {
  id: string;
  kind: 'staff' | 'schedule_request' | 'report';
  context: { tenant_name?: string; class_name?: string; student_first_name?: string; report_title?: string } | null;
  last_message: ChatMessage | null;
  last_message_at: string | null;
  unread_count: number;
}

export type ChatEvent =
  | { type: 'message.created'; conversation_id: string; message: ChatMessage }
  | { type: 'conversation.read'; conversation_id: string; user_id: string; read_at: string };

export const CHAT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function compareMessages(a: ChatMessage, b: ChatMessage): number {
  return Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id);
}

export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  let merged = [...existing];
  for (const message of incoming) {
    // A REST reply and a broadcast can arrive in either order. An optimistic
    // row is replaced by the authoritative row with the same client id.
    merged = merged.filter((row) => row.id !== message.id && !(row.client_message_id && row.client_message_id === message.client_message_id && row.sender_user_id === message.sender_user_id));
    merged.push(message);
  }
  return merged.sort(compareMessages);
}

export function updateDelivery(messages: ChatMessage[], clientId: string, delivery: 'sending' | 'failed'): ChatMessage[] {
  return messages.map((message) => message.client_message_id === clientId && message.delivery ? { ...message, delivery } : message);
}

export function applyChatEvent(conversations: ChatConversation[], event: ChatEvent, userId: string, activeId: string | null): ChatConversation[] {
  if (event.type !== 'message.created' || !event.message || event.message.conversation_id !== event.conversation_id) {
    if (event.type === 'conversation.read' && event.user_id === userId) {
      return conversations.map((c) => c.id === event.conversation_id ? { ...c, unread_count: 0 } : c);
    }
    return conversations;
  }
  return conversations.map((c) => {
    if (c.id !== event.conversation_id) return c;
    if (c.last_message?.id === event.message.id) return c;
    const newer = !c.last_message || compareMessages(event.message, c.last_message) >= 0;
    return {
      ...c,
      last_message: newer ? event.message : c.last_message,
      last_message_at: newer ? event.message.created_at : c.last_message_at,
      unread_count: event.message.sender_user_id === userId || activeId === c.id ? c.unread_count : c.unread_count + 1,
    };
  });
}

export function chatTitle(conversation: ChatConversation): string {
  if (conversation.kind === 'staff') return 'Tim tenant';
  return conversation.context?.class_name || conversation.context?.report_title || (conversation.kind === 'report' ? 'Laporan' : 'Permintaan jadwal');
}

export function senderLabel(message: ChatMessage, userId: string): string {
  if (message.sender_user_id === userId) return 'Anda';
  if (message.sender_kind === 'parent') return 'Parent';
  if (message.sender_kind === 'teacher') return 'Pengajar';
  return 'Tenant';
}

export function chatWebSocketUrl(base: string | undefined, ticket: string): string | null {
  try {
    if (!base) return null;
    const url = new URL(base);
    if (!['ws:', 'wss:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) return null;
    url.pathname = '/api/v1/chat/ws';
    url.searchParams.set('ticket', ticket);
    return url.toString();
  } catch {
    return null;
  }
}
