import { describe, expect, it, vi } from 'vitest';
import {
  parseMerchantOrderId,
  PAYMENT_RETURN_PATH,
  refreshDecision,
  RETURN_REFRESH_INTERVAL_MS,
  RETURN_REFRESH_WINDOW_MS,
  startRefreshLoop,
} from './payment-return';

describe('parseMerchantOrderId (KEL-44)', () => {
  it('accepts the transaction UUID billing sends for a first payment', () => {
    expect(parseMerchantOrderId('2d8f7a0c-7a0a-4aa8-8e54-000000000001')).toBe('2d8f7a0c-7a0a-4aa8-8e54-000000000001');
  });

  it('accepts the renewal-<uuid> id billing sends for a subscription renewal', () => {
    expect(parseMerchantOrderId('renewal-2d8f7a0c-7a0a-4aa8-8e54-000000000001')).toBe('renewal-2d8f7a0c-7a0a-4aa8-8e54-000000000001');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['repeated', ['a', 'b']],
    ['a LIKE wildcard', '%'],
    ['an underscore wildcard', 'abc_def'],
    ['a path', '../etc/passwd'],
    ['markup', '<script>'],
    ['whitespace', 'abc def'],
    ['longer than the 50 characters Duitku allows', 'a'.repeat(51)],
  ])('rejects %s', (_label, value) => {
    expect(parseMerchantOrderId(value as string | string[] | undefined)).toBeNull();
  });
});

describe('refreshDecision (KEL-44)', () => {
  const base = { settling: true, startedAt: 1_000, now: 1_000, hidden: false, pending: false };

  it('refreshes while the status is settling inside the window', () => {
    expect(refreshDecision({ ...base, now: base.startedAt + RETURN_REFRESH_INTERVAL_MS })).toBe('refresh');
  });

  it('stops as soon as the backend reports a final status', () => {
    expect(refreshDecision({ ...base, settling: false })).toBe('stop');
  });

  it('stops once the refresh window has elapsed', () => {
    expect(refreshDecision({ ...base, now: base.startedAt + RETURN_REFRESH_WINDOW_MS })).toBe('stop');
    expect(refreshDecision({ ...base, now: base.startedAt + RETURN_REFRESH_WINDOW_MS - 1 })).toBe('refresh');
  });

  it('never overlaps refreshes and pauses in a hidden tab', () => {
    expect(refreshDecision({ ...base, pending: true })).toBe('wait');
    expect(refreshDecision({ ...base, hidden: true })).toBe('wait');
  });

  it('bounds the load one forgotten tab can put on the gateway', () => {
    expect(RETURN_REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(3_000);
    expect(RETURN_REFRESH_WINDOW_MS / RETURN_REFRESH_INTERVAL_MS).toBeLessThanOrEqual(30);
  });

  it('lives under the parent-only dashboard segment that proxy.ts protects', () => {
    expect(PAYMENT_RETURN_PATH.startsWith('/dashboard/parent/')).toBe(true);
  });
});

describe('startRefreshLoop (KEL-44)', () => {
  function setup(overrides: { settling?: boolean; hidden?: () => boolean; pending?: () => boolean } = {}) {
    vi.useFakeTimers();
    const startedAt = Date.now();
    const refresh = vi.fn();
    const onStop = vi.fn();
    const dispose = startRefreshLoop({
      settling: overrides.settling ?? true,
      startedAt,
      now: () => Date.now(),
      hidden: overrides.hidden ?? (() => false),
      pending: overrides.pending ?? (() => false),
      refresh,
      onStop,
    });
    return { refresh, onStop, dispose };
  }

  it('refreshes once per interval while the status is settling, then stops at the window', () => {
    const { refresh, onStop, dispose } = setup();
    vi.advanceTimersByTime(RETURN_REFRESH_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(RETURN_REFRESH_WINDOW_MS);
    expect(refresh).toHaveBeenCalledTimes(RETURN_REFRESH_WINDOW_MS / RETURN_REFRESH_INTERVAL_MS - 1);
    expect(onStop).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(RETURN_REFRESH_WINDOW_MS);
    expect(refresh).toHaveBeenCalledTimes(RETURN_REFRESH_WINDOW_MS / RETURN_REFRESH_INTERVAL_MS - 1);
    dispose();
    vi.useRealTimers();
  });

  it('never refreshes a final status', () => {
    const { refresh, onStop, dispose } = setup({ settling: false });
    vi.advanceTimersByTime(RETURN_REFRESH_INTERVAL_MS * 3);
    expect(refresh).not.toHaveBeenCalled();
    expect(onStop).toHaveBeenCalledTimes(1);
    dispose();
    vi.useRealTimers();
  });

  it('skips ticks while a refresh is in flight or the tab is hidden', () => {
    let pending = true;
    let hidden = false;
    const { refresh, dispose } = setup({ pending: () => pending, hidden: () => hidden });
    vi.advanceTimersByTime(RETURN_REFRESH_INTERVAL_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
    pending = false;
    hidden = true;
    vi.advanceTimersByTime(RETURN_REFRESH_INTERVAL_MS * 2);
    expect(refresh).not.toHaveBeenCalled();
    hidden = false;
    vi.advanceTimersByTime(RETURN_REFRESH_INTERVAL_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
    dispose();
    vi.useRealTimers();
  });

  it('stops ticking once disposed, as when the re-rendered status is final', () => {
    const { refresh, dispose } = setup();
    dispose();
    vi.advanceTimersByTime(RETURN_REFRESH_INTERVAL_MS * 5);
    expect(refresh).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
