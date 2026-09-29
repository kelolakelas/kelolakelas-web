import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/gateway', () => ({ getGatewayBaseUrl: () => 'http://gateway', getGatewayConfigurationErrorMessage: () => null }));
import { cookies } from 'next/headers';
import { createReportChat, createScheduleRequestChat, getChatConversation, sendChatMessage, createStaffChat, issueChatTicket } from './chat-actions';

const id = 'ab321b1a-63b2-4d3a-8b56-acc739170972';
const conversation = { id, kind: 'schedule_request', context: {}, last_message: null, last_message_at: null, unread_count: 0 };
beforeEach(() => {
  vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: 'test-token' }) } as never);
  vi.stubGlobal('fetch', vi.fn());
});

function success(data: unknown, status = 201) {
  return { status, ok: true, json: async () => ({ status: 'success', data }) } as Response;
}

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

  it('maps 403 to a no-access message the caller can show inline', async () => {
    vi.mocked(fetch).mockResolvedValue({ status: 403, ok: false, json: async () => ({ message: 'private details' }) } as Response);
    expect((await getChatConversation(id)).error).toContain('tidak memiliki akses');
  });

  it.each([
    ['schedule_request', createScheduleRequestChat],
    ['report', createReportChat],
  ])('get-or-creates a %s conversation with kind and subject', async (kind, start) => {
    vi.mocked(fetch).mockResolvedValue(success(conversation));
    const result = await start(id);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(conversation);
    expect(fetch).toHaveBeenCalledWith(
      'http://gateway/api/v1/chat/conversations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ kind, subject_id: id }),
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('returns the same conversation when the entry is pressed again', async () => {
    vi.mocked(fetch).mockResolvedValue(success(conversation));
    const first = await createScheduleRequestChat(id);
    const second = await createScheduleRequestChat(id);
    expect(first.data?.id).toBe(second.data?.id);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('maps entry-point refusals to clear messages without leaking details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ status: 403, ok: false, json: async () => ({ message: 'forbidden' }) } as Response);
    expect((await createScheduleRequestChat(id)).error).toContain('tidak memiliki akses');
    vi.mocked(fetch).mockResolvedValueOnce({ status: 404, ok: false, json: async () => ({ message: 'unknown subject' }) } as Response);
    expect((await createReportChat(id)).error).toContain('tidak ditemukan');
    vi.mocked(fetch).mockResolvedValueOnce({ status: 503, ok: false, json: async () => ({}) } as Response);
    expect((await createReportChat(id)).error).toContain('tidak tersedia');
  });

  it('rejects invalid entry subjects without a network call', async () => {
    expect((await createScheduleRequestChat('../bad')).error).toBeTruthy();
    expect((await createReportChat('')).error).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
