'use client';

import { useId, useState } from 'react';
import { switchTenant } from '@/lib/tenant-session-actions';
import { publishContext, readBrowserTenantScope } from '@/lib/tenant-context-events';
import type { TenantChoice } from '@/lib/tenant-session';

export function TenantSwitcher({ choices, activeTenant, error, scope }: {
  choices: TenantChoice[]; activeTenant: string; error: boolean; scope: string | null;
}) {
  const id = useId();
  const [selected, setSelected] = useState(activeTenant);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const current = choices.find(choice => choice.tenant_id === activeTenant);

  async function changeTenant() {
    if (!scope || !navigator.locks) { setMessage('Browser ini belum mendukung perpindahan tenant yang aman. Gunakan browser terbaru.'); return; }
    await navigator.locks.request('kelolakelas-tenant-switch', { ifAvailable: true }, async lock => {
      if (!lock) { setMessage('Perpindahan tenant sedang berlangsung pada tab lain.'); return; }
      try { publishContext({ phase: 'switching', scope: scope! }); }
      catch { setMessage('Izinkan penyimpanan browser agar perubahan tenant dapat diselaraskan antar tab.'); return; }
      try {
        const result = await switchTenant(scope!, selected);
        publishContext({ phase: 'ready', scope: result.scope || scope!, error: result.ok ? undefined : result.message });
        window.location.replace('/dashboard/tenant');
      } catch {
        // A lost response may have set cookies. Recovery always re-reads them.
        let actualScope: string | null = scope;
        try { actualScope = await readBrowserTenantScope(); } catch { /* The next document keeps a mismatching scope blocked until revalidation. */ }
        try { publishContext({ phase: 'ready', scope: actualScope || '', error: 'Perpindahan belum dapat dikonfirmasi. Periksa tenant aktif sebelum melanjutkan.' }); } catch { /* A full navigation still resets the UI if storage becomes unavailable. */ }
        window.location.replace('/dashboard/tenant');
      }
    });
  }

  if (error) return <div role="alert" className="mb-4 rounded-xl border p-3">Pilihan tenant belum dapat dimuat. <button type="button" onClick={() => window.location.reload()} className="underline">Coba lagi</button></div>;
  return <section aria-label="Tenant aktif" className="mb-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4 text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
    <p className="text-sm"><strong>{current?.tenant_name || 'Tidak ada membership aktif'}</strong>{current && ` · ${current.role_name}`}</p>
    {choices.length > 1 && <form onSubmit={event => { event.preventDefault(); setConfirming(true); }} className="flex flex-wrap items-end gap-3">
      <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1 text-sm">Pilih tenant
        <select id={id} value={selected} onChange={event => { setSelected(event.target.value); setConfirming(false); }} className="min-h-11 w-full rounded-lg border bg-white p-2 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
          {choices.map(choice => <option key={choice.tenant_id} value={choice.tenant_id}>{choice.tenant_name} · {choice.role_name} ({choice.tenant_id.slice(-8)})</option>)}
        </select>
      </label>
      <button type="submit" disabled={selected === activeTenant} className="min-h-11 rounded-lg bg-blue-600 px-4 text-white disabled:opacity-50">Beralih tenant</button>
    </form>}
    {confirming && <div role="alert" className="space-y-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
      <p>Peralihan akan memuat ulang dashboard pada semua tab. Simpan perubahan yang belum disimpan sebelum melanjutkan.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => { void changeTenant(); }} className="min-h-11 rounded-lg border px-3">Lanjutkan beralih</button>
        <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-lg border px-3">Batal</button>
      </div>
    </div>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
