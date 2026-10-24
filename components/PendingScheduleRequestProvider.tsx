'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { readPendingScheduleRequestCount } from '@/lib/schedule-request-count-actions';
import { SCHEDULE_REQUEST_COUNT_REFRESH } from '@/lib/schedule-request-count-events';

const UnreadContext = createContext<number | null>(null);

export function usePendingScheduleRequestCount() {
  return useContext(UnreadContext);
}

export function PendingScheduleRequestProvider({ scope, enabled = true, children }: {
  scope: string | null;
  enabled?: boolean;
  children: ReactNode;
}) {
  // Re-key before paint so no count/in-flight response survives a session switch.
  return <ScopedUnread key={`${scope}:${enabled}`} scope={enabled ? scope : null}>{children}</ScopedUnread>;
}

function ScopedUnread({ scope, children }: { scope: string | null; children: ReactNode }) {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!scope) return;
    let stopped = false;
    let running = false;
    let queued = false;
    async function refresh() {
      if (stopped || document.visibilityState === 'hidden') return;
      if (running) { queued = true; return; }
      running = true;
      do {
        queued = false;
        try {
          const result = await readPendingScheduleRequestCount(scope!);
          if (!stopped) setCount(result.count);
        } catch {
          if (!stopped) setCount(null);
        }
      } while (queued && !stopped);
      running = false;
    }
    const reconcile = () => { void refresh(); };
    window.addEventListener('focus', reconcile);
    window.addEventListener('online', reconcile);
    window.addEventListener(SCHEDULE_REQUEST_COUNT_REFRESH, reconcile);
    document.addEventListener('visibilitychange', reconcile);
    const timer = setInterval(reconcile, 10000);
    reconcile();
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('focus', reconcile);
      window.removeEventListener('online', reconcile);
      window.removeEventListener(SCHEDULE_REQUEST_COUNT_REFRESH, reconcile);
      document.removeEventListener('visibilitychange', reconcile);
    };
  }, [scope, pathname]);
  return <UnreadContext value={count}>{children}</UnreadContext>;
}
