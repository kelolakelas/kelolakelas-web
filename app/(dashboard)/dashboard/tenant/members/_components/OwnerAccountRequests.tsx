import { readCreatorRequests } from '@/lib/creator-requests';
import { RequestForm } from '../../creator-requests/RequestForm';

export async function OwnerAccountRequests() {
  const result = await readCreatorRequests(false);
  // Identity checks the caller's live Creator membership; never infer it from
  // a decoded token, member:read, or the ability to invite ordinary members.
  if (result.status === 401 || result.status === 403) return null;

  return (
    <section id="owner-account-request" aria-labelledby="owner-account-request-title" className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6 dark:border-gray-800 dark:bg-gray-900">
      <h2 id="owner-account-request-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">Owner Account Request</h2>
      {result.status !== 200 ? <p role="alert">{result.message}</p> : <>
        <RequestForm />
        <section aria-label="Owner Account Request status">
          <h3 className="font-semibold">Status</h3>
          {result.data.length === 0 ? <p>No requests yet.</p> : (
            <ul className="space-y-3">
              {result.data.map(item => (
                <li key={item.id} className="break-words rounded border p-3">
                  <strong>{item.target_email}</strong> — {item.status}
                  <p className="whitespace-pre-wrap">{item.reason}</p>
                  {item.rejection_reason && <p>Rejection reason: {item.rejection_reason}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </>}
    </section>
  );
}
