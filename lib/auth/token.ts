export interface TokenClaims {
  exp?: number;
  tenant_id?: string;
  role?: string;
  sub?: string;
  user_id?: string;
  is_parent?: boolean;
}

export type DashboardRole = 'parent' | 'tenant' | 'unknown';

export function isTokenExpired(token: string): boolean {
  try {
    const decoded = decodeTokenClaims(token);
    return typeof decoded.exp === 'number' && decoded.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export function decodeTokenClaims(token: string): TokenClaims {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Invalid JWT');
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as TokenClaims;
}

export function getDashboardRole(claims: TokenClaims): DashboardRole {
  if (claims.is_parent === true || claims.role === 'parent') return 'parent';
  if (claims.tenant_id || claims.role) return 'tenant';
  return 'unknown';
}

export function getDashboardPath(role: DashboardRole): string {
  return role === 'parent' ? '/dashboard/parent' : '/dashboard/tenant';
}