// Only opaque cache scopes are shared across tabs. Tokens stay in HttpOnly cookies.
export const TENANT_CONTEXT_KEY = 'kelolakelas.tenant-context';
const EVENT = 'kelolakelas:tenant-context';
export interface ContextChange { phase: 'switching' | 'ready'; scope: string; error?: string }
export async function readBrowserTenantScope(): Promise<string | null> {
  const response = await fetch('/api/tenant-context', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('session unavailable');
  const body = await response.json();
  if (body.scope !== null && typeof body.scope !== 'string') throw new Error('invalid scope');
  return body.scope;
}
export function contextSnapshot(): string {
  try { return window.localStorage.getItem(TENANT_CONTEXT_KEY) || ''; } catch { return ''; }
}
export function parseContextChange(raw: string): ContextChange | null {
  try {
    const data = JSON.parse(raw);
    return (data.phase === 'switching' || data.phase === 'ready') && typeof data.scope === 'string' ? data : null;
  } catch { return null; }
}
export function publishContext(change: ContextChange) {
  window.localStorage.setItem(TENANT_CONTEXT_KEY, JSON.stringify(change));
  window.dispatchEvent(new Event(EVENT));
}
export function subscribeContext(notify: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === TENANT_CONTEXT_KEY) notify(); };
  window.addEventListener(EVENT, notify);
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener(EVENT, notify); window.removeEventListener('storage', storage); };
}
