'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { contextSnapshot, parseContextChange, publishContext, subscribeContext, readBrowserTenantScope } from '@/lib/tenant-context-events';
import { installTenantActionGuard } from '@/lib/tenant-action-guard';

export function TenantContextBoundary({ scope, children }: { scope: string | null; children: ReactNode }) {
  const [recoveryError, setRecoveryError] = useState('');
  const raw = useSyncExternalStore(subscribeContext, contextSnapshot, () => 'checking');
  const change = parseContextChange(raw);
  const blocked = raw === 'checking' || change?.phase === 'switching' || (change?.phase === 'ready' && change.scope !== scope);
  useEffect(() => {
    if (scope && !installTenantActionGuard(scope) && parseContextChange(raw)?.phase !== 'switching') { window.location.replace('/dashboard/tenant'); return; }
    let stopped = false;
    async function reconcile() {
      try {
        const current = await readBrowserTenantScope();
        if (stopped) return;
        if (current !== scope) {
          publishContext({ phase: 'ready', scope: current || '' });
          window.location.replace('/dashboard/tenant');
        } else {
          const stored = parseContextChange(contextSnapshot());
          // A new login can replace cookies without going through the switcher.
          // Reconcile stale browser metadata against the current server session.
          if (stored?.phase === 'ready' && stored.scope !== scope) publishContext({ phase: 'ready', scope: scope || '' });
        }
      } catch { /* Keep the current boundary; the explicit recovery retries. */ }
    }
    const check = () => { void reconcile(); };
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    const timer = setInterval(check, 10000);
    check();
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', check); window.removeEventListener('pageshow', check); };
  }, [scope, raw]);

  async function recover() {
    try {
      if (!navigator.locks) { setRecoveryError('Gunakan browser terbaru untuk memeriksa sesi tenant.'); return; }
      await navigator.locks.request('kelolakelas-tenant-switch', { ifAvailable: true }, async lock => {
        if (!lock) { setRecoveryError('Perpindahan masih berjalan pada tab lain. Coba lagi setelah selesai.'); return; }
        const current = await readBrowserTenantScope();
        publishContext({ phase: 'ready', scope: current || '' });
        window.location.replace('/dashboard/tenant');
      });
    } catch { setRecoveryError('Sesi belum dapat diperiksa. Periksa koneksi lalu coba lagi.'); }
  }

  if (blocked) return <main className="mx-auto max-w-lg space-y-4 p-8" aria-busy="true">
    <p role="status">Memuat konteks tenant. Data dan koneksi sebelumnya telah ditutup.</p>
    {recoveryError && <p role="alert">{recoveryError}</p>}
    <button type="button" onClick={() => { void recover(); }} className="rounded-lg border p-3">Periksa sesi dan muat ulang</button>
  </main>;
  return <>{change?.error && <p role="alert" className="bg-amber-50 p-4 text-amber-900">{change.error}</p>}{children}</>;
}
