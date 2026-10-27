'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getGatewayBaseUrl } from './gateway';
import { readChatUnreadScope } from './chat-unread-scope';
import { isTenantChoice, type TenantChoice } from './tenant-session';

export async function readTenantChoices(): Promise<{ choices: TenantChoice[]; activeTenant: string; error: boolean }> {
  const jar = await cookies();
  const activeTenant = jar.get(process.env.TENANT_ID_COOKIE_NAME || 'tenant_id')?.value || '';
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/auth/memberships`, {
      headers: { Authorization: `Bearer ${jar.get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value || ''}` },
      cache: 'no-store', signal: AbortSignal.timeout(10000),
    });
    const body: unknown = await response.json();
    const result = body as { status?: string; data?: unknown };
    if (!response.ok || result.status !== 'success' || !Array.isArray(result.data) || !result.data.every(isTenantChoice)) throw new Error('unavailable');
    return { choices: result.data, activeTenant, error: false };
  } catch {
    return { choices: [], activeTenant, error: true };
  }
}

export async function switchTenant(expectedScope: string, tenantId: string): Promise<{ ok: boolean; scope?: string; message?: string }> {
  if (!expectedScope || await readChatUnreadScope() !== expectedScope) {
    return { ok: false, message: 'Sesi telah berubah. Muat ulang halaman sebelum memilih tenant.' };
  }
  const jar = await cookies();
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/auth/tenant`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jar.get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value || ''}` },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    const result = await response.json();
    if (!response.ok || result.status !== 'success' || typeof result.data?.token !== 'string' ||
      !isTenantChoice(result.data?.membership) || result.data.membership.tenant_id !== tenantId) {
      return { ok: false, message: response.status === 401 ? 'Sesi berakhir. Silakan login kembali.' :
        response.status === 403 ? 'Membership tenant ini tidak lagi aktif atau tidak dapat dipilih.' : 'Belum dapat beralih tenant. Silakan coba lagi.' };
    }
    const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 86400 };
    jar.set(process.env.AUTH_COOKIE_NAME || 'auth_token', result.data.token, options);
    jar.set(process.env.TENANT_ID_COOKIE_NAME || 'tenant_id', tenantId, options);
  } catch {
    return { ok: false, message: 'Koneksi gagal. Muat ulang untuk memeriksa sesi sebelum mencoba lagi.' };
  }
  revalidatePath('/', 'layout');
  return { ok: true, scope: await readChatUnreadScope() || undefined };
}
