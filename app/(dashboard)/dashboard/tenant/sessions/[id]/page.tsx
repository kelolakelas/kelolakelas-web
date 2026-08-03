import type { Metadata } from 'next';
import Link from 'next/link';
import { SessionActions } from '../_components/SessionActions';
import { getSession, getSessionAttendees, getTutors } from '../_queries/queries';

interface SessionDetailPageProps { params: Promise<{ id: string }> }

export const metadata: Metadata = {
  title: 'Session Detail - Tenant Dashboard',
  description: 'Detail peserta dan tindakan session tenant.',
  alternates: { canonical: '/dashboard/tenant/sessions' },
};

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { id } = await params;
  const [sessionResult, result, tutors] = await Promise.all([
    getSession(id),
    getSessionAttendees(id),
    getTutors(),
  ]);
  const attendees = result.data?.attendees || [];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/dashboard/tenant/sessions" className="text-sm font-semibold text-blue-700">Kembali ke session</Link>
      <header className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-bold text-gray-900">Detail session</h1>
        <p className="mt-1 break-all text-xs text-gray-500">ID: {id}</p>
      </header>
      {sessionResult.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{sessionResult.error}</div>}
      {sessionResult.data && <section className="rounded-2xl border border-gray-200 bg-white p-5"><h2 className="font-semibold">{sessionResult.data.class?.name || sessionResult.data.class_id}</h2><p className="mt-1 text-sm text-gray-600">{sessionResult.data.session_date.slice(0, 10)} · {sessionResult.data.start_time} - {sessionResult.data.end_time} · {sessionResult.data.status}</p></section>}
      {result.data && <section className="rounded-2xl border border-gray-200 bg-white p-5"><h2 className="font-semibold text-gray-900">Peserta ({attendees.length})</h2>{attendees.length === 0 ? <p className="mt-3 text-sm text-gray-500">Belum ada peserta pada session ini.</p> : <ul className="mt-3 divide-y divide-gray-100">{attendees.map((attendee) => <li key={attendee.id || attendee.student_id} className="py-3 text-sm text-gray-700">{attendee.student ? `${attendee.student.first_name || ''} ${attendee.student.last_name || ''}`.trim() || attendee.student.email : attendee.student_id || 'Peserta'}<span className="ml-2 text-xs text-gray-500">{attendee.status || 'unknown'}</span></li>)}</ul>}</section>}
      <SessionActions sessionId={id} tutors={tutors.data} />
    </main>
  );
}