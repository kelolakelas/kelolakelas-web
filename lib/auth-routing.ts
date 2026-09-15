export const PARENT_DESTINATION = '/kelas';
export const TENANT_DESTINATION = '/dashboard/tenant';
export const UNKNOWN_DESTINATION = '/';

export interface LoginIdentity {
  is_parent?: boolean;
  tenant_id?: string | null;
}

export function hasTenantContext(tenantId: unknown): tenantId is string {
  return (
    typeof tenantId === 'string' &&
    tenantId.trim().length > 0 &&
    !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(tenantId.trim())
  );
}

export function isSafeRedirectPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\');
}

function isPathWithin(value: string, root: string) {
  try {
    const pathname = new URL(value, 'http://localhost').pathname;
    return pathname === root || pathname.startsWith(`${root}/`);
  } catch {
    return false;
  }
}

export function getLoginDestination(identity: LoginIdentity, requestedPath?: unknown) {
  const fallback = identity.is_parent
    ? PARENT_DESTINATION
    : hasTenantContext(identity.tenant_id)
      ? TENANT_DESTINATION
      : UNKNOWN_DESTINATION;

  if (!isSafeRedirectPath(requestedPath)) {
    return fallback;
  }

  if (identity.is_parent && isPathWithin(requestedPath, PARENT_DESTINATION)) {
    return requestedPath;
  }

  if (!identity.is_parent && hasTenantContext(identity.tenant_id) && isPathWithin(requestedPath, TENANT_DESTINATION)) {
    return requestedPath;
  }

  return fallback;
}
