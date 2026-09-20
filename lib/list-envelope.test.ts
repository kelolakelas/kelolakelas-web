import { describe, expect, it } from 'vitest';
import {
  emptyListPagination,
  normalizeListEnvelope,
  normalizeListPagination,
} from './list-envelope';

const pagination = {
  page: 2,
  page_size: 20,
  total_items: 45,
  total_pages: 3,
};

describe('normalizeListEnvelope', () => {
  it('unwraps the paginated envelope returned by the academic service', () => {
    const result = normalizeListEnvelope<{ id: string }>({
      items: [{ id: 'a' }, { id: 'b' }],
      pagination,
    });

    expect(result.items).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(result.pagination).toEqual(pagination);
  });

  it('still accepts a bare array and reports plausible pagination', () => {
    const result = normalizeListEnvelope<number>([1, 2, 3]);

    expect(result.items).toEqual([1, 2, 3]);
    expect(result.pagination).toEqual({
      page: 1,
      page_size: 3,
      total_items: 3,
      total_pages: 1,
    });
  });

  it('describes an empty bare array as a zero-length first page', () => {
    const result = normalizeListEnvelope<string>([]);

    expect(result.items).toEqual([]);
    expect(result.pagination.total_items).toBe(0);
    expect(result.pagination.total_pages).toBe(0);
    expect(result.pagination.page).toBe(1);
  });

  it('returns an empty envelope for malformed payloads instead of throwing', () => {
    for (const value of [null, undefined, 'nope', 42, true]) {
      const result = normalizeListEnvelope(value);

      expect(result.items).toEqual([]);
      expect(result.pagination).toEqual(emptyListPagination());
    }
  });

  it('drops a non-array items field but keeps the pagination', () => {
    const result = normalizeListEnvelope({ items: 'not-an-array', pagination });

    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual(pagination);
  });

  it('defaults the pagination when the envelope omits it', () => {
    const result = normalizeListEnvelope({ items: [{ id: 'a' }] });

    expect(result.items).toEqual([{ id: 'a' }]);
    expect(result.pagination).toEqual(emptyListPagination());
  });

  it('reads a paginated envelope through an unknown-typed boundary', () => {
    const raw: unknown = JSON.parse(
      '{"items":[{"id":"class-1"}],"pagination":{"page":1,"page_size":100,"total_items":1,"total_pages":1}}'
    );

    expect(normalizeListEnvelope<{ id: string }>(raw).items).toEqual([
      { id: 'class-1' },
    ]);
  });
});

describe('normalizeListPagination', () => {
  it('clamps the page to at least 1', () => {
    expect(normalizeListPagination({ ...pagination, page: 0 }).page).toBe(1);
    expect(normalizeListPagination({ ...pagination, page: -5 }).page).toBe(1);
  });

  it('falls back per field for values that are not non-negative integers', () => {
    const result = normalizeListPagination({
      page: 1,
      page_size: '20',
      total_items: 1.5,
      total_pages: null,
    });

    expect(result).toEqual({
      page: 1,
      page_size: 0,
      total_items: 0,
      total_pages: 0,
    });
  });

  it('returns the empty pagination for non-object input', () => {
    expect(normalizeListPagination(null)).toEqual(emptyListPagination());
    expect(normalizeListPagination([])).toEqual(emptyListPagination());
  });
});
