import { getAuthCookieName } from '@/lib/api/client';
import { decodeTokenClaims, getDashboardRole } from '@/lib/auth/token';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(getAuthCookieName())?.value;
  if (!token) redirect('/login?redirectTo=/dashboard/parent');

  try {
    if (getDashboardRole(decodeTokenClaims(token)) !== 'parent') redirect('/dashboard/tenant');
  } catch {
    redirect('/login?redirectTo=/dashboard/parent');
  }

  return children;
}