'use server';

import { cookies } from 'next/headers';
import { getGatewayBaseUrl, getGatewayConfigurationErrorMessage } from '@/lib/gateway';
import { CHAT_ID, type ChatConversation, type ChatMessage } from '@/lib/chat';

type ChatResult<T> = { data: T; error: null } | { data: null; error: string };
const PATH = '/api/v1/chat';
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'auth_token';

async function chatRequest<T>(path: string, method = 'GET', body?: unknown): Promise<ChatResult<T>> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    if (!token) return { data: null, error: 'Sesi Anda tidak valid. Silakan login kembali.' };
    const response = await fetch(`${getGatewayBaseUrl()}${PATH}${path}`, {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) return { data: null, error: 'Sesi Anda tidak valid. Silakan login kembali.' };
    if (response.status === 404) return { data: null, error: 'Percakapan tidak ditemukan.' };
    if (response.status === 400) return { data: null, error: 'Input chat tidak valid. Periksa kembali pesan Anda.' };
    if (!response.ok || result.status !== 'success') return { data: null, error: 'Layanan chat sedang tidak tersedia. Coba lagi nanti.' };
    return { data: result.data as T, error: null };
  } catch (error) {
    return { data: null, error: getGatewayConfigurationErrorMessage(error) || 'Layanan chat sedang tidak tersedia. Coba lagi nanti.' };
  }
}

export async function listChatConversations(): Promise<ChatResult<ChatConversation[]>> {
  return chatRequest<ChatConversation[]>('/conversations?page=1&page_size=100');
}

export async function getChatConversation(id: string): Promise<ChatResult<ChatConversation>> {
  if (!CHAT_ID.test(id)) return { data: null, error: 'Percakapan tidak ditemukan.' };
  return chatRequest<ChatConversation>(`/conversations/${id}`);
}

export async function listChatMessages(id: string, before?: string): Promise<ChatResult<ChatMessage[]>> {
  if (!CHAT_ID.test(id) || (before && !CHAT_ID.test(before))) return { data: null, error: 'Percakapan tidak ditemukan.' };
  return chatRequest<ChatMessage[]>(`/conversations/${id}/messages?limit=100${before ? `&before=${before}` : ''}`);
}

export async function sendChatMessage(id: string, body: string, clientId: string): Promise<ChatResult<ChatMessage>> {
  if (!CHAT_ID.test(id) || !CHAT_ID.test(clientId) || !body.trim() || [...body.trim()].length > 2000) return { data: null, error: 'Input chat tidak valid. Periksa kembali pesan Anda.' };
  return chatRequest<ChatMessage>(`/conversations/${id}/messages`, 'POST', { body, client_message_id: clientId });
}

export async function markChatRead(id: string): Promise<ChatResult<null>> {
  if (!CHAT_ID.test(id)) return { data: null, error: 'Percakapan tidak ditemukan.' };
  return chatRequest<null>(`/conversations/${id}/read`, 'POST');
}

export async function createStaffChat(): Promise<ChatResult<ChatConversation>> {
  return chatRequest<ChatConversation>('/conversations', 'POST', { kind: 'staff' });
}

export async function issueChatTicket(): Promise<ChatResult<{ ticket: string; expires_at: string }>> {
  return chatRequest<{ ticket: string; expires_at: string }>('/ws-tickets', 'POST');
}
