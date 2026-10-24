'use server';

import { listChatConversations } from './chat-actions';
import { readChatUnreadScope } from './chat-unread-scope';

/** Count messages, across all visible pages, stopping only at the display cap. */
export async function readChatUnreadCount(expectedScope: string): Promise<{ count: number | null }> {
  if (!expectedScope || await readChatUnreadScope() !== expectedScope) return { count: null };
  const seen = new Set<string>();
  let count = 0;
  for (let page = 1; ; page++) {
    const result = await listChatConversations(page);
    if (result.error || !Array.isArray(result.data)) return { count: null };
    let added = 0;
    for (const conversation of result.data) {
      if (typeof conversation.id !== 'string' || !Number.isSafeInteger(conversation.unread_count) || conversation.unread_count < 0) return { count: null };
      if (seen.has(conversation.id)) continue;
      seen.add(conversation.id);
      added++;
      count = Math.min(100, count + conversation.unread_count);
      if (count === 100) return { count };
    }
    if (result.data.length < 100) return { count };
    // A malformed/repeating page must not loop or claim a complete zero.
    if (added === 0) return { count: null };
  }
}
