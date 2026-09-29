import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getUserIdFromToken } from '@/lib/auth-session';
import { CHAT_ID } from '@/lib/chat';
import { listChatConversations } from '@/lib/chat-actions';
import { ChatInbox } from './_components/ChatInbox';

export const metadata: Metadata = { title: 'Chat - KelolaKelas' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function firstConversationId(input: Record<string, string | string[] | undefined>): string | null {
  const raw = input.conversation;
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return typeof value === 'string' && CHAT_ID.test(value) ? value : null;
}

/**
 * Parent chat inbox (KEL-123, extended KEL-124).
 *
 * Schedule-request entry buttons deep-link here with
 * `?conversation=<id>`; the id is validated as a UUID and passed to the
 * inbox as the initial selection, so the button lands in the right room
 * instead of the first row. A missing or malformed value falls back to the
 * default selection and is never rendered.
 */
export default async function ParentChatPage({ searchParams }: Props) {
  const userId = getUserIdFromToken((await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value);
  const result = userId ? await listChatConversations() : { data: null, error: 'Sesi Anda tidak valid. Silakan login kembali.' };
  const initialConversationId = firstConversationId(await searchParams);
  return <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f]"><div className="mx-auto max-w-6xl"><Link href="/dashboard/parent/students" className="text-sm font-bold text-[#617c35]">← Student saya</Link><h1 className="my-6 text-3xl font-black">Chat</h1>{result.error || !userId ? <p role="alert">{result.error}</p> : <ChatInbox initial={result.data || []} userId={userId} tenant={false} initialConversationId={initialConversationId} />}</div></main>;
}
