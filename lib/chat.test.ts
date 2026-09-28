import { describe, expect, it } from 'vitest';
import { applyChatEvent, chatWebSocketUrl, mergeMessages, updateDelivery, type ChatConversation, type ChatMessage } from './chat';

const message: ChatMessage = { id: 'server', conversation_id: 'room', sender_user_id: 'me', sender_kind: 'tenant', body: '<b>literal</b>', client_message_id: 'client', created_at: '2026-01-01T00:00:00Z' };
const room: ChatConversation = { id: 'room', kind: 'staff', context: {}, last_message: null, last_message_at: null, unread_count: 0 };

describe('chat state', () => {
  it('confirms optimistic messages by client id regardless of REST/WS arrival order', () => {
    const optimistic = { ...message, id: 'client', delivery: 'sending' as const };
    expect(mergeMessages([optimistic], [message])).toEqual([message]);
    expect(mergeMessages([message], [message])).toEqual([message]);
    expect(mergeMessages(updateDelivery([optimistic], 'client', 'failed'), [message])).toEqual([message]);
    expect(updateDelivery([optimistic], 'client', 'failed')[0].delivery).toBe('failed');
  });

  it('orders optimistic and failed rows by instant across UTC and offset timestamps', () => {
    const older = { ...message, id: 'older', client_message_id: 'older', created_at: '2026-09-29T02:19:40.92659+07:00' };
    const failed = { ...message, id: 'failed', client_message_id: 'failed', created_at: '2026-09-28T19:20:40.927Z', delivery: 'failed' as const };
    const sameInstant = { ...message, id: 'same', client_message_id: 'same', created_at: '2026-09-29T02:20:40.927+07:00' };
    expect(mergeMessages([older], [failed, sameInstant]).map((row) => row.id)).toEqual(['older', 'failed', 'same']);
    expect(mergeMessages([older], [{ ...failed, delivery: 'sending' }]).map((row) => row.id)).toEqual(['older', 'failed']);
  });

  it('keeps the newest conversation preview by instant, using id for a timestamp tie', () => {
    const latest = { ...message, id: 'b', created_at: '2026-09-29T02:20:40+07:00' };
    const current = { ...room, last_message: latest, last_message_at: latest.created_at };
    const older = { ...message, id: 'z', created_at: '2026-09-28T19:19:40Z' };
    const event = (row: ChatMessage) => ({ type: 'message.created' as const, conversation_id: 'room', message: row });
    expect(applyChatEvent([current], event(older), 'me', null)[0].last_message).toEqual(latest);
    const tiedEarlier = { ...message, id: 'a', created_at: '2026-09-28T19:20:40Z' };
    expect(applyChatEvent([current], event(tiedEarlier), 'me', null)[0].last_message).toEqual(latest);
    const tiedLater = { ...tiedEarlier, id: 'c' };
    expect(applyChatEvent([current], event(tiedLater), 'me', null)[0].last_message).toEqual(tiedLater);
  });

  it('applies message and read events, preserving other rooms', () => {
    const rooms = [room, { ...room, id: 'other' }];
    const event = { type: 'message.created' as const, conversation_id: 'room', message: { ...message, sender_user_id: 'them' } };
    const updated = applyChatEvent(rooms, event, 'me', null);
    expect(updated[0].unread_count).toBe(1);
    expect(updated[1]).toBe(rooms[1]);
    expect(applyChatEvent(updated, event, 'me', null)[0].unread_count).toBe(1);
    expect(applyChatEvent(updated, { type: 'conversation.read', conversation_id: 'room', user_id: 'me', read_at: '' }, 'me', null)[0].unread_count).toBe(0);
  });

  it('only builds a ticket URL from a clean WS origin', () => {
    expect(chatWebSocketUrl('wss://example.com', 'a+b')).toBe('wss://example.com/api/v1/chat/ws?ticket=a%2Bb');
    expect(chatWebSocketUrl('https://example.com', 'ticket')).toBeNull();
    expect(chatWebSocketUrl('wss://example.com/other', 'ticket')).toBeNull();
  });
});
