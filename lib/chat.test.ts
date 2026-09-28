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
