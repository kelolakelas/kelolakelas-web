import { describe, expect, it } from 'vitest';
import { getTokenStatus } from './token';

function token(claims: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

describe('getTokenStatus', () => {
  it('recognizes a valid token', () => {
    expect(getTokenStatus(token({ exp: Math.floor(Date.now() / 1000) + 3600 }))).toBe('valid');
  });

  it('recognizes an expired token', () => {
    expect(getTokenStatus(token({ exp: Math.floor(Date.now() / 1000) - 1 }))).toBe('expired');
  });

  it('recognizes an invalid and missing token', () => {
    expect(getTokenStatus('not-a-jwt')).toBe('invalid');
    expect(getTokenStatus()).toBe('missing');
  });
});
