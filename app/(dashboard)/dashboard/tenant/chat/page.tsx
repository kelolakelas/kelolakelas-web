import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getUserIdFromToken } from '@/lib/auth-session';
import { listChatConversations } from '@/lib/chat-actions';
import { ChatInbox } from '../../parent/chat/_components/ChatInbox';

export const metadata: Metadata = { title: 'Chat tenant - KelolaKelas' };
export const dynamic = 'force-dynamic';

export default async function TenantChatPage() {
  const userId = getUserIdFromToken((await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value);
  const result = userId ? await listChatConversations() : { data: null, error: 'Sesi Anda tidak valid. Silakan login kembali.' };
  return <div className="mx-auto max-w-6xl"><h1 className="mb-6 text-3xl font-black">Chat</h1>{result.error || !userId ? <p role="alert">{result.error}</p> : <ChatInbox initial={result.data || []} userId={userId} tenant />}</div>;
}
