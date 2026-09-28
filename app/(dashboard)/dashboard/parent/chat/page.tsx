import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getUserIdFromToken } from '@/lib/auth-session';
import { listChatConversations } from '@/lib/chat-actions';
import { ChatInbox } from './_components/ChatInbox';

export const metadata: Metadata = { title: 'Chat - KelolaKelas' };
export const dynamic = 'force-dynamic';

export default async function ParentChatPage() {
  const userId = getUserIdFromToken((await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value);
  const result = userId ? await listChatConversations() : { data: null, error: 'Sesi Anda tidak valid. Silakan login kembali.' };
  return <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f]"><div className="mx-auto max-w-6xl"><Link href="/dashboard/parent/students" className="text-sm font-bold text-[#617c35]">← Student saya</Link><h1 className="my-6 text-3xl font-black">Chat</h1>{result.error || !userId ? <p role="alert">{result.error}</p> : <ChatInbox initial={result.data || []} userId={userId} tenant={false} />}</div></main>;
}
