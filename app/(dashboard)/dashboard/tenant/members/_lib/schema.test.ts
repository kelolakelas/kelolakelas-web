import { describe, expect, it } from 'vitest';
import { memberPageHref, membersQueryString, parseMemberPage } from './schema';

describe('parseMemberPage', () => {
  it('defaults to the first page when the parameter is absent or empty', () => {
    expect(parseMemberPage({})).toBe(1);
    expect(parseMemberPage({ page: '' })).toBe(1);
  });

  it('accepts a positive integer page and uses the first repeated value', () => {
    expect(parseMemberPage({ page: '3' })).toBe(3);
    expect(parseMemberPage({ page: ['2', '3'] })).toBe(2);
  });

  it('falls back to the first page for malformed or out-of-range values', () => {
    for (const page of ['0', '-1', '1.5', 'two', '1e2', '999999999999999999999999999999999999999']) {
      expect(parseMemberPage({ page })).toBe(1);
    }
  });
});

describe('membersQueryString', () => {
  it('always sends the requested page and a page size of 20', () => {
    const query = new URLSearchParams(membersQueryString(3));

    expect(query.get('page')).toBe('3');
    expect(query.get('page_size')).toBe('20');
  });
});

describe('memberPageHref', () => {
  it('keeps the first page URL canonical and links to subsequent pages', () => {
    expect(memberPageHref(1)).toBe('/dashboard/tenant/members');
    expect(memberPageHref(2)).toBe('/dashboard/tenant/members?page=2');
    expect(memberPageHref(3)).toBe('/dashboard/tenant/members?page=3');
  });
});
