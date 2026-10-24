'use client';

import { useChatUnreadCount } from './ChatUnreadProvider';
import { NavigationBadge } from './NavigationBadge';

/** Also usable inside a server-rendered secondary Chat link. */
export function ChatUnreadBadge() {
  return <NavigationBadge count={useChatUnreadCount()} />;
}
