import { readCreatorRequests } from '@/lib/creator-requests';
import { RequestForm } from './RequestForm';

export const dynamic = 'force-dynamic';

export default async function TenantCreatorRequestsPage() {
  const result = await readCreatorRequests(false);
  return <main className="mx-auto max-w-3xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Creator requests</h1>
    {result.status === 200 ? <>
      <RequestForm />
      <section aria-label="Request status"><h2 className="text-lg font-semibold">Status</h2>
        {result.data.length === 0 ? <p>No requests yet.</p> : <ul className="space-y-3">{result.data.map(item => <li key={item.id} className="rounded border p-3"><strong>{item.target_email}</strong> — {item.status}<p>{item.reason}</p>{item.rejection_reason && <p>Rejection reason: {item.rejection_reason}</p>}</li>)}</ul>}
      </section>
    </> : <p role="alert">{result.message}</p>}
  </main>;
}
