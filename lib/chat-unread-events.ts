export const CHAT_UNREAD_REFRESH = 'kelolakelas:chat-unread-refresh';
export const CHAT_UNREAD_CHANNEL = 'kelolakelas-chat-unread';

/** Only invalidation travels between tabs; counts always come from the server. */
export function openChatUnreadChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHAT_UNREAD_CHANNEL);
  } catch {
    return null; // Polling/focus still reconcile when browser storage policy denies channels.
  }
}

export function notifyChatUnreadChanged() {
  window.dispatchEvent(new Event(CHAT_UNREAD_REFRESH));
  const channel = openChatUnreadChannel();
  if (channel) {
    channel.postMessage('refresh');
    channel.close();
  }
}
