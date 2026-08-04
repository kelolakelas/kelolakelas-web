import type { Metadata } from 'next';
import Link from 'next/link';
import { CancelSessionButton } from './_components/CancelSessionButton';
import { getSessions } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Session Management - Tenant Dashboard',
  description: 'Kelola peserta dan perubahan jadwal session organisasi.',
  alternates: { canonical: '/dashboard/tenant/sessions' },
};

export default async function TenantSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    class_id?: string;
    date_from?: string;
    date_to?: string;
  }>;
}) {
  const params = await searchParams;
  const result = await getSessions({
    ...params,
    page: Math.max(1, Number(params.page) || 1),
  });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6">
      <header className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-bold text-gray-900">Session management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Session diambil dari endpoint akademik tenant.
        </p>
      </header>
      <form method="get" className="grid gap-2 sm:grid-cols-5">
        <input
          name="search"
          defaultValue={params.search}
          placeholder="Cari session"
          className="min-h-11 rounded-lg border border-gray-300 px-3"
        />
        <select
          name="status"
          defaultValue={params.status || ''}
          className="min-h-11 rounded-lg border border-gray-300 px-3"
        >
          <option value="">Semua status</option>
          <option value="scheduled">Scheduled</option>
          <option value="rescheduled">Rescheduled</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <input
          name="date_from"
          type="date"
          defaultValue={params.date_from}
          className="min-h-11 rounded-lg border border-gray-300 px-3"
        />
        <input
          name="date_to"
          type="date"
          defaultValue={params.date_to}
          className="min-h-11 rounded-lg border border-gray-300 px-3"
        />
        <button className="min-h-11 rounded-lg bg-gray-900 text-sm font-semibold text-white">
          Filter
        </button>
      </form>
      {result.error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {result.error}
        </div>
      )}
      {result.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Belum ada session pada filter ini.
        </div>
      ) : (
        <div className="space-y-3">
          {result.data.map((session) => (
            <article
              key={session.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h2 className="font-semibold">{session.class?.name || session.class_id}</h2>
                <p className="text-sm text-gray-600">
                  {session.session_date.slice(0, 10)} · {session.start_time} - {session.end_time}
                </p>
                <p className="text-xs text-gray-500">Status: {session.status}</p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Link
                  href={`/dashboard/tenant/sessions/${session.id}`}
                  className="inline-flex min-h-11 items-center rounded-lg border border-blue-200 px-3 text-sm font-semibold text-blue-700"
                >
                  Detail & peserta
                </Link>
                {!['cancelled', 'completed'].includes(session.status) && (
                  <CancelSessionButton sessionId={session.id} />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}