/**
 * Normalisation helpers for the paginated list envelopes returned by the
 * KelolaKelas backend services.
 *
 * Every list endpoint (`GET /api/v1/classes`, `/categories`, `/schedules`, ...)
 * answers with `{"status":"success","data":{"items":[...],"pagination":{...}}}`
 * and the API gateway proxies that body through untouched. Reading `data` as a
 * bare array therefore silently yields zero rows for every such endpoint.
 *
 * Run the `data` payload through `normalizeListEnvelope`, which accepts both the
 * enveloped and the legacy bare-array shape and never throws on malformed input.
 */

export interface ListPagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ListEnvelope<T> {
  items: T[];
  pagination: ListPagination;
}

export function emptyListPagination(): ListPagination {
  return { page: 1, page_size: 0, total_items: 0, total_pages: 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

/**
 * Reads a `pagination` object, defaulting every field that is missing or not a
 * non-negative integer. `page` is always at least 1.
 */
export function normalizeListPagination(value: unknown): ListPagination {
  if (!isRecord(value)) {
    return emptyListPagination();
  }

  const page = nonNegativeInteger(value.page, 1);

  return {
    page: page >= 1 ? page : 1,
    page_size: nonNegativeInteger(value.page_size, 0),
    total_items: nonNegativeInteger(value.total_items, 0),
    total_pages: nonNegativeInteger(value.total_pages, 0),
  };
}

/**
 * Unwraps a backend list payload into `{ items, pagination }`.
 *
 * Accepts the paginated envelope, a bare array (older or non-paginated
 * endpoints) and malformed input, which produces an empty envelope instead of
 * throwing.
 */
export function normalizeListEnvelope<T>(value: unknown): ListEnvelope<T> {
  if (Array.isArray(value)) {
    return {
      items: value as T[],
      pagination: {
        page: 1,
        page_size: value.length,
        total_items: value.length,
        total_pages: value.length > 0 ? 1 : 0,
      },
    };
  }

  if (!isRecord(value)) {
    return { items: [], pagination: emptyListPagination() };
  }

  return {
    items: Array.isArray(value.items) ? (value.items as T[]) : [],
    pagination: normalizeListPagination(value.pagination),
  };
}
