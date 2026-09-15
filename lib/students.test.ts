import { describe, expect, it } from 'vitest';
import {
  dateInputValue,
  normalizeStudentList,
  studentFormSchema,
  studentLastName,
  studentPayload,
} from './students';
import { getSessionIdentityFromToken, getUserIdFromToken } from './auth-session';

const parentId = '123e4567-e89b-12d3-a456-426614174000';

describe('student helpers', () => {
  it('validates the API-compatible parent form', () => {
    expect(studentFormSchema.safeParse({
      first_name: 'Alya',
      last_name: 'Zam',
      nickname: 'Aly',
      gender: 'female',
      date_of_birth: '2018-02-03',
    }).success).toBe(true);
    expect(studentFormSchema.safeParse({ first_name: '', date_of_birth: '2018-02-31' }).success).toBe(false);
  });

  it('omits empty optional values and adds parent ownership on create', () => {
    expect(studentPayload(studentFormSchema.parse({ first_name: 'Alya', date_of_birth: '2018-02-03' }), parentId)).toEqual({
      parent_id: parentId,
      first_name: 'Alya',
      date_of_birth: '2018-02-03',
    });
  });

  it('handles the current response field typo without exposing it in the UI', () => {
    expect(studentLastName({ id: '1', parent_id: parentId, first_name: 'Alya', ['lastå_name']: 'Zam' })).toBe('Zam');
    expect(dateInputValue('2018-02-03T00:00:00Z')).toBe('2018-02-03');
    expect(normalizeStudentList({ items: [{ id: '1' }] }).items).toHaveLength(1);
  });
});

describe('session user id helper', () => {
  it('reads only a UUID user_id claim from a JWT-shaped token', () => {
    const payload = Buffer.from(JSON.stringify({ user_id: parentId })).toString('base64url');
    expect(getUserIdFromToken(`header.${payload}.signature`)).toBe(parentId);
    expect(getUserIdFromToken('not-a-token')).toBeNull();
  });

  it('identifies a parent session without trusting client-provided form data', () => {
    const payload = Buffer.from(JSON.stringify({ user_id: parentId, is_parent: true })).toString('base64url');
    expect(getSessionIdentityFromToken(`header.${payload}.signature`)).toEqual({ userId: parentId, isParent: true });
  });
});
