import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';

/** An opaque UI cache boundary only; backend JWT/permission checks authorize reads. */
export async function readChatUnreadScope(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  if (!token) return null;
  const tenant = jar.get(process.env.TENANT_ID_COOKIE_NAME || 'tenant_id')?.value || '';
  return createHash('sha256').update(JSON.stringify([token, tenant])).digest('hex');
}
