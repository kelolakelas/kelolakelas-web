export function isTokenExpired(token: string): boolean {
  try {
    const decoded = decodeTokenClaims(token);
    return typeof decoded.exp === 'number' && decoded.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export function decodeTokenClaims(token: string): { exp?: number; tenant_id?: string; role?: string; sub?: string; user_id?: string; is_parent?: boolean } {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Invalid JWT');
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as {
    exp?: number;
    tenant_id?: string;
    role?: string;
    sub?: string;
    user_id?: string;
    is_parent?: boolean;
  };
}