'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { startRefreshLoop } from '@/lib/payment-return';

/**
 * Re-renders the payment return page from the backend while its status can
 * still change (KEL-44).
 *
 * `router.refresh()` re-runs the Server Component, so every new status comes
 * from billing and academic, never from this component. The refresh is bounded:
 * one request at a time, paused while the tab is hidden, stopped once the page
 * reports a final status, and stopped after `RETURN_REFRESH_WINDOW_MS`. The
 * window is anchored to the first mount; `router.refresh()` keeps client state,
 * so later renders do not restart it. After the window the parent can ask for
 * one more check with the button, which also starts a new window.
 */
export function PaymentReturnRefresher({ settling }: { settling: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pendingRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const [windowElapsed, setWindowElapsed] = useState(false);

  // Mirrors `isPending` for the interval callback, which would otherwise read the
  // value captured when the loop started. A tick that lands while a refresh is
  // still in flight waits instead of stacking a second request.
  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    if (!settling || windowElapsed) return;
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    return startRefreshLoop({
      settling,
      startedAt: startedAtRef.current,
      now: Date.now,
      hidden: () => document.visibilityState === 'hidden',
      pending: () => pendingRef.current,
      refresh: () => startTransition(() => router.refresh()),
      onStop: () => setWindowElapsed(true),
    });
  }, [settling, windowElapsed, router]);

  if (!settling) return null;

  if (!windowElapsed) {
    return (
      <p className="mt-5 text-sm text-[#65726c]">
        {isPending ? 'Memeriksa status terbaru…' : 'Status diperbarui otomatis setiap beberapa detik.'}
      </p>
    );
  }

  return (
    <div className="mt-5 border-t border-[#edf0e9] pt-4">
      <p className="text-sm text-[#52615b]">
        Status masih diproses. Pembaruan otomatis dihentikan; periksa lagi sebentar lagi.
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          startedAtRef.current = Date.now();
          setWindowElapsed(false);
          startTransition(() => router.refresh());
        }}
        className="mt-3 min-h-11 rounded-xl border border-[#dfe3d7] bg-white px-4 text-sm font-bold text-[#617c35] hover:bg-[#eef4e8] disabled:opacity-60"
      >
        {isPending ? 'Memeriksa…' : 'Periksa status sekarang'}
      </button>
    </div>
  );
}
