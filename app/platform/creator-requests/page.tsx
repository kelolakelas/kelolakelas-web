import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readCreatorRequests } from '@/lib/creator-requests';
import { DecisionForm } from './DecisionForm';

export const dynamic = 'force-dynamic';

export default async function PlatformCreatorRequestsPage() {
  const result = await readCreatorRequests(true);
  if (result.status === 401) redirect('/platform/login');
  return <main className="mx-auto max-w-3xl space-y-6 p-6">
    <Link href="/platform" className="underline">Platform admin</Link>
    <h1 className="text-2xl font-semibold">Pending Creator requests</h1>
    {result.status !== 200 ? <p role="alert">{result.message}</p> : result.data.length === 0 ? <p>No pending Creator requests.</p> : <ul className="space-y-6">{result.data.map(item => <li key={item.id}><h2 className="font-semibold">{item.tenant_name} ({item.tenant_id})</h2><p>Requested by {item.requester_user_id} for {item.target_email}</p><p>Reason: {item.reason}</p><p>Status: {item.status} · Submitted: {item.created_at}</p><DecisionForm id={item.id} email={item.target_email} /></li>)}</ul>}
  </main>;
}
