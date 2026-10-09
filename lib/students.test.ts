import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dateInputValue,
  normalizeStudentList,
  studentFormSchema,
  studentLastName,
  studentPayload,
  studentToday,
  type Student,
} from './students';
import { getSessionIdentityFromToken, getUserIdFromToken } from './auth-session';

const parentId = '123e4567-e89b-12d3-a456-426614174000';

describe('student helpers', () => {
  afterEach(() => vi.useRealTimers());

  it.each(['2026-10-08T17:00:00Z', '2026-10-09T16:59:59Z'])('uses the WIB calendar at %s', (instant) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    expect(studentToday()).toBe('2026-10-09');
    for (const date of ['2026-10-09', '2018-02-03']) {
      expect(studentFormSchema.safeParse({ first_name: 'Alya', date_of_birth: date }).success).toBe(true);
    }
    const future = studentFormSchema.safeParse({ first_name: 'Alya', date_of_birth: '2026-10-10' });
    expect(future.success).toBe(false);
    if (!future.success) {
      expect(future.error.flatten().fieldErrors.date_of_birth).toEqual(['Tanggal lahir tidak boleh di masa depan']);
    }
  });

  it('recomputes today at validation time across midnight WIB', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T16:59:59Z'));
    const input = { first_name: 'Alya', date_of_birth: '2026-10-09' };
    expect(studentFormSchema.safeParse(input).success).toBe(false);
    vi.setSystemTime(new Date('2026-10-08T17:00:00Z'));
    expect(studentFormSchema.safeParse(input).success).toBe(true);
  });
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

  it('reads the corrected last_name key and still accepts the legacy key during rollout', () => {
    const base: Student = { id: '1', parent_id: parentId, first_name: 'Alya' };
    expect(studentLastName({ ...base, last_name: 'Zam' })).toBe('Zam');
    expect(studentLastName({ ...base, ['lastå_name']: 'Zam' })).toBe('Zam');
    expect(studentLastName({ ...base, last_name: 'Zam', ['lastå_name']: 'Salah' })).toBe('Zam');
    // A blank or null corrected key must not hide a legacy value, nor render whitespace.
    expect(studentLastName({ ...base, last_name: '  ', ['lastå_name']: ' Zam ' })).toBe('Zam');
    expect(studentLastName({ ...base, last_name: null })).toBe('');
    expect(studentLastName({ ...base })).toBe('');
    expect(studentLastName(undefined)).toBe('');
  });

  it('normalizes dates and list envelopes', () => {
    expect(dateInputValue('2018-02-03T00:00:00Z')).toBe('2018-02-03');
    expect(normalizeStudentList({ items: [{ id: '1' }] }).items).toHaveLength(1);
  });

  it('still rejects an over-long last name and never sends the legacy key', () => {
    const tooLong = studentFormSchema.safeParse({ first_name: 'Alya', last_name: 'x'.repeat(256), date_of_birth: '2018-02-03' });
    expect(tooLong.success).toBe(false);
    const payload = studentPayload(studentFormSchema.parse({ first_name: 'Alya', last_name: ' Zam ', date_of_birth: '2018-02-03' }));
    expect(payload).toEqual({ first_name: 'Alya', last_name: 'Zam', date_of_birth: '2018-02-03' });
    expect(Object.keys(payload)).not.toContain('lastå_name');
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
