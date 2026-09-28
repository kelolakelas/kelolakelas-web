import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/gateway', () => ({ getGatewayBaseUrl: () => 'http://gateway', getGatewayConfigurationErrorMessage: () => null }));
import { cookies } from 'next/headers';
import { getChatConversation, sendChatMessage, createStaffChat, issueChatTicket } from './chat-actions';

const id = 'ab321b1a-63b2-4d3a-8b56-acc739170972';
beforeEach(() => {
  vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: 'test-token' }) } as never);
  vi.stubGlobal('fetch', vi.fn());
});

describe('chat server actions', () => {
  it.each([[401, 'Sesi Anda tidak valid'], [404, 'Percakapan tidak ditemukan'], [400, 'Input chat tidak valid']])('maps %i safely', async (status, expected) => {
    vi.mocked(fetch).mockResolvedValue({ status, ok: false, json: async () => ({ message: 'private details' }) } as Response);
    expect((await getChatConversation(id)).error).toContain(expected);
  });
  it('keeps JWT on the server and uses the same idempotency key on send', async () => {
    vi.mocked(fetch).mockResolvedValue({ status: 201, ok: true, json: async () => ({ status: 'success', data: { id } }) } as Response);
    expect((await sendChatMessage(id, 'hi', id)).data).toEqual({ id });
    expect(fetch).toHaveBeenCalledWith(`http://gateway/api/v1/chat/conversations/${id}/messages`, expect.objectContaining({ body: JSON.stringify({ body: 'hi', client_message_id: id }), headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
    expect((await createStaffChat()).error).toBeNull();
    expect((await issueChatTicket()).error).toBeNull();
  });
  it('rejects invalid identifiers without a network call', async () => {
    expect((await getChatConversation('../bad')).error).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
