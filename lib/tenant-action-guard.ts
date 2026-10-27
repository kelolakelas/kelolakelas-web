// Bind actions to the tenant UI that initiated them, even after another tab
// replaces the shared cookies. The backend remains the authorization boundary.
let documentScope: string | null = null;
export function installTenantActionGuard(scope: string): boolean {
  if (documentScope !== null) return documentScope === scope;
  documentScope = scope;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (url.origin === window.location.origin &&
      (url.pathname === '/dashboard/tenant' || url.pathname.startsWith('/dashboard/tenant/')) && headers.has('Next-Action')) {
      headers.set('X-Tenant-UI-Scope', scope);
      return original(input, { ...init, headers }).then(response => {
        if (response.status === 409 && response.headers.get('X-Tenant-UI-Stale') === '1') {
          window.location.replace('/dashboard/tenant');
          // This action belongs to a document being discarded. Delivering the
          // response to Next would reject old polling promises during teardown.
          return new Promise<Response>(() => {});
        }
        return response;
      });
    }
    return original(input, init);
  };
  // Keep this binding until document navigation: an old asynchronous action
  // can outlive the subtree that originally dispatched it.
  return true;
}
