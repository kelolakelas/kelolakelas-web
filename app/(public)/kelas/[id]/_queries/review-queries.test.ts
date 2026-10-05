import { afterEach, describe, expect, it, vi } from 'vitest';
import { getClassReviews } from './review-queries';

/**
 * Fetch test for the public class-review list (KEL-160).
 *
 * What is asserted is the wire contract the academic `review_handler.go`
 * serves through the gateway: the exact public path, the gateway
 * configuration, and that a malformed `ReviewListResponse` is an `api`
 * error — never a valid empty list the page would render as "no reviews".
 */

const gatewayUrl = process.env.GATEWAY_API_URL;

afterEach(() => {
  vi.restoreAllMocks();
  if (gatewayUrl === undefined) delete process.env.GATEWAY_API_URL;
  else process.env.GATEWAY_API_URL = gatewayUrl;
});

function gatewayReviewsResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const reviewItem = {
  rating: 5,
  comment: 'Kelasnya bagus.',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
};

const listBody = {
  status: 'success',
  message: 'Reviews fetched',
  data: {
    items: [reviewItem],
    pagination: { page: 1, page_size: 10, total_items: 1, total_pages: 1 },
  },
};

describe('getClassReviews', () => {
  it('fetches the first page from the public gateway route', async () => {
    process.env.GATEWAY_API_URL = 'https://gateway.example.test';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(gatewayReviewsResponse(listBody));

    const result = await getClassReviews('class-1');

    expect(result.error).toBeUndefined();
    expect(result.data?.items).toEqual([reviewItem]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://gateway.example.test/api/v1/catalog/classes/class-1/reviews?page=1&page_size=10');
    expect((init?.headers as Record<string, string>).Accept).toBe('application/json');
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('rejects a non-positive page without reaching the network', async () => {
    process.env.GATEWAY_API_URL = 'https://gateway.example.test';
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    expect(await getClassReviews('class-1', 0)).toEqual({ error: 'invalid' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a missing class as not_found', async () => {
    process.env.GATEWAY_API_URL = 'https://gateway.example.test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 404 }));

    await expect(getClassReviews('missing')).resolves.toEqual({ error: 'not_found' });
  });

  it('fails closed on a malformed envelope instead of rendering garbage', async () => {
    process.env.GATEWAY_API_URL = 'https://gateway.example.test';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(gatewayReviewsResponse({
      status: 'success',
      data: { items: [{ rating: 99, comment: 'x' }], pagination: {} },
    }));

    await expect(getClassReviews('class-1')).resolves.toEqual({ error: 'api' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the envelope reports an error', async () => {
    process.env.GATEWAY_API_URL = 'https://gateway.example.test';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(gatewayReviewsResponse({ status: 'error', message: 'no', data: null }));

    await expect(getClassReviews('class-1')).resolves.toEqual({ error: 'api' });
  });
});
