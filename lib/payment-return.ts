/**
 * Payment-provider return landing (KEL-44).
 *
 * Duitku sends the parent's browser back to `DUITKU_RETURN_URL` with
 * `merchantOrderId`, `resultCode` and `reference` in the query string. None of
 * those values is signed, so the landing page uses `merchantOrderId` only as a
 * lookup key for a transaction the backend scopes to the signed-in parent, and
 * never reads `resultCode` at all: the status shown always comes from billing and
 * academic, which only change after the verified provider callback.
 */

/** Route registered as `DUITKU_RETURN_URL` (`<app origin>` + this path). */
export const PAYMENT_RETURN_PATH = '/dashboard/parent/enrollments/return';

/** Pause between automatic status refreshes while a payment is still settling. */
export const RETURN_REFRESH_INTERVAL_MS = 5_000;

/**
 * Total time the page refreshes on its own. Each refresh costs one billing and
 * one academic read through the gateway, so the window caps a forgotten tab at
 * 24 refreshes; after it the parent can ask for another check explicitly.
 */
export const RETURN_REFRESH_WINDOW_MS = 120_000;

/**
 * Billing writes the transaction UUID (first payment) or `renewal-<uuid>`
 * (subscription renewal) as the merchant order id, and Duitku caps the field at
 * 50 characters. Accepting only letters, digits and hyphens also keeps SQL
 * `ILIKE` wildcards (`%`, `_`) out of billing's `search` filter.
 */
const MERCHANT_ORDER_ID_PATTERN = /^[A-Za-z0-9-]{1,50}$/;

/**
 * Returns the merchant order id from the return URL, or null when it is absent,
 * repeated, or not shaped like an id billing could have issued. A null result
 * means the page must not call the backend at all.
 */
export function parseMerchantOrderId(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null;
  return MERCHANT_ORDER_ID_PATTERN.test(value) ? value : null;
}

export type RefreshDecision = 'refresh' | 'wait' | 'stop';

/**
 * Decides what one tick of the automatic refresh does.
 *
 * - `stop` once the status is final or the refresh window has elapsed;
 * - `wait` while the tab is hidden or the previous refresh is still in flight,
 *   so a slow gateway never accumulates overlapping requests;
 * - `refresh` otherwise.
 */
export function refreshDecision(input: {
  settling: boolean;
  startedAt: number;
  now: number;
  hidden: boolean;
  pending: boolean;
}): RefreshDecision {
  if (!input.settling) return 'stop';
  if (input.now - input.startedAt >= RETURN_REFRESH_WINDOW_MS) return 'stop';
  if (input.hidden || input.pending) return 'wait';
  return 'refresh';
}

/**
 * Runs the bounded automatic refresh for one rendered status (KEL-44).
 *
 * Every `RETURN_REFRESH_INTERVAL_MS` it asks `refreshDecision` what to do,
 * calls `refresh` (a Server Component re-render, so the next status again comes
 * from the backend) or waits, and calls `onStop` once when the status is final
 * or the window has elapsed. When the re-rendered status changes, the caller
 * disposes this loop and starts a new one with the new `settling` value and the
 * same `startedAt`, so the window never restarts on its own.
 *
 * Returns a disposer that clears the timer.
 */
export function startRefreshLoop(options: {
  settling: boolean;
  startedAt: number;
  now: () => number;
  hidden: () => boolean;
  pending: () => boolean;
  refresh: () => void;
  onStop: () => void;
}): () => void {
  const tick = () => {
    const decision = refreshDecision({
      settling: options.settling,
      startedAt: options.startedAt,
      now: options.now(),
      hidden: options.hidden(),
      pending: options.pending(),
    });
    if (decision === 'stop') {
      clearInterval(timer);
      options.onStop();
      return;
    }
    if (decision === 'refresh') options.refresh();
  };
  const timer = setInterval(tick, RETURN_REFRESH_INTERVAL_MS);
  return () => clearInterval(timer);
}
