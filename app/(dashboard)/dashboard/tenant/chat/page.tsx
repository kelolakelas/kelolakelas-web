import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getUserIdFromToken } from '@/lib/auth-session';
import { CHAT_ID } from '@/lib/chat';
import { listChatConversations } from '@/lib/chat-actions';
import { ChatInbox } from '../../parent/chat/_components/ChatInbox';
import { ReportChatStarter } from './_components/ReportChatStarter';

export const metadata: Metadata = { title: 'Chat tenant - KelolaKelas' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function firstConversationId(input: Record<string, string | string[] | undefined>): string | null {
  const raw = input.conversation;
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return typeof value === 'string' && CHAT_ID.test(value) ? value : null;
}

/**
 * Tenant chat inbox (KEL-123, extended KEL-124).
 *
 * Accepts the same `?conversation=<id>` deep-link as the parent page so
 * schedule-request entry buttons land in the right room. Below the inbox it
 * mounts the report picker: the picker probes `GET /api/v1/reports` once and
 * renders only for members whose role carries `report:read`; everyone else
 * never sees the control, and the chat-service enforces the same permission
 * when the conversation is created.
 */
export default async function TenantChatPage({ searchParams }: Props) {
  const userId = getUserIdFromToken((await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value);
  const result = userId ? await listChatConversations() : { data: null, error: 'Sesi Anda tidak valid. Silakan login kembali.' };
  const initialConversationId = firstConversationId(await searchParams);
  return <div className="mx-auto max-w-6xl"><h1 className="mb-6 text-3xl font-black">Chat</h1>{result.error || !userId ? <p role="alert">{result.error}</p> : <><ChatInbox initial={result.data || []} userId={userId} tenant initialConversationId={initialConversationId} /><div className="mt-6"><ReportChatStarter /></div></>}</div>;
}
