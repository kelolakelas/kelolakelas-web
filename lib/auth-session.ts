type SessionPayload = { user_id?: unknown; is_parent?: unknown };

export type SessionIdentity = { userId: string; isParent: boolean };

function decodeSessionPayload(token: string): SessionPayload | null {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    return JSON.parse(decoded) as SessionPayload;
  } catch {
    return null;
  }
}

export function getSessionIdentityFromToken(token: string | undefined): SessionIdentity | null {
  if (!token) return null;
  const payload = decodeSessionPayload(token);
  if (!payload || typeof payload.user_id !== 'string') return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.user_id)) return null;
  return { userId: payload.user_id, isParent: payload.is_parent === true };
}

export function getUserIdFromToken(token: string | undefined): string | null {
  return getSessionIdentityFromToken(token)?.userId || null;
}
