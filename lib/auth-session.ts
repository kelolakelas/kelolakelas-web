type SessionPayload = { user_id?: unknown };

export function getUserIdFromToken(token: string | undefined): string | null {
  if (!token) return null;

  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const payload = JSON.parse(decoded) as SessionPayload;
    return typeof payload.user_id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.user_id)
      ? payload.user_id
      : null;
  } catch {
    return null;
  }
}
