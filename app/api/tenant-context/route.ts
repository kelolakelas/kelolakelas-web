import { readChatUnreadScope } from '@/lib/chat-unread-scope';

/** Opaque cookie boundary only; this does not authorize access to tenant data. */
export async function GET() {
  return Response.json({ scope: await readChatUnreadScope() }, { headers: { 'Cache-Control': 'no-store' } });
}
