import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getGatewayBaseUrl } from '@/lib/gateway';

export default async function PlatformHome() {
  const token = (await cookies()).get(process.env.AUTH_COOKIE_NAME || 'auth_token')?.value;
  if (!token) redirect('/platform/login');
  let status = 503;
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/api/v1/platform/me`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    status = response.status;
  } catch { /* Fail closed: never render platform data without identity authorization. */ }
  if (status === 401 || status === 403) redirect('/platform/login');
  if (status !== 200) return <main role="alert">Platform authorization unavailable. Try again later.</main>;
  return <main className="mx-auto max-w-2xl p-8"><h1 className="text-2xl font-semibold">Platform admin</h1><p>Second factor verified.</p><Link href="/platform/creator-requests" className="underline">Review Creator requests</Link></main>;
}
