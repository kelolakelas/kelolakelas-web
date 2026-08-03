'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(process.env.AUTH_COOKIE_NAME || 'auth_token');
  cookieStore.delete(process.env.TENANT_ID_COOKIE_NAME || 'tenant_id');
  redirect('/login');
}