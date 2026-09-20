'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { clearSessionCookies, LOGOUT_DESTINATION } from '@/lib/logout';

/**
 * Server Action that ends the current session.
 *
 * Both session cookies are deleted unconditionally. Deleting a cookie that is not
 * present raises no error, so signing out while already signed out stays silent
 * instead of failing the screen.
 *
 * `revalidatePath('/', 'layout')` purges the Client Cache before navigating. Without
 * it the router can serve a protected page it already rendered from its cache, which
 * would make logout look like it failed until a hard reload.
 *
 * Limitation: identity exposes no token revocation endpoint, so this only ends the
 * browser session. The JWT remains valid until its 24-hour expiry.
 */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();

  clearSessionCookies(cookieStore, process.env);

  revalidatePath('/', 'layout');

  // Navigation errors must remain outside any try/catch so Next.js can handle them.
  redirect(LOGOUT_DESTINATION);
}
