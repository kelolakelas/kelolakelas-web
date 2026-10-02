import type { Metadata } from 'next';
import Link from 'next/link';
import { getStudents } from '../students/_queries/queries';
import {
  attendanceForStudent,
  formatJakartaDate,
  formatSessionLabel,
  isProgressUuid,
  reportsForStudent,
  resolveSelectedStudentId,
  sessionsForStudent,
  summarizeAttendance,
  ATTENDANCE_STATUS_LABEL,
  type ProgressEnrollment,
} from './_lib/progress';
import {
  getStudentAttendance,
  getStudentReports,
  getUpcomingSessions,
} from './_queries/queries';
import { getEnrollmentHistory } from '../enrollments/_queries/queries';
import { StudentSelector } from './_components/StudentSelector';

export const metadata: Metadata = {
  title: 'Jadwal & Progres Anak - KelolaKelas',
  description: 'Jadwal sesi mendatang, riwayat kehadiran, dan laporan anak.',
};

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function requestedStudent(input: Record<string, string | string[] | undefined>): string | null {
  const raw = input.student;
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
  return typeof value === 'string' && value ? value : null;
}

function SectionError({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-3 rounded-2xl border border-[#f2c6c3] bg-white p-4 text-sm text-[#b42318]">
      {message}
    </p>
  );
}

/**
 * Parent progress portal (KEL-141): upcoming sessions (two weeks), attendance
 * history with a summary, and report list per child.
 *
 * Server scoping: students come from the parent's own list; the attendance
 * and report lists pass `student_id` to the backend (KEL-140 narrows the
 * parent's own rows, a foreign id yields an empty list); sessions carry no
 * `student_id` filter, so upcoming rows are attributed client-side through
 * the enrollment join (`sessionsForStudent`). Read-only: no POST/PATCH/DELETE.
 */
export default async function ParentProgressPage({ searchParams }: Props) {
  const params = await searchParams;
  const studentsResult = await getStudents();

  if (studentsResult.error) {
    return (
      <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f] sm:px-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-3xl border border-[#f2c6c3] bg-white p-8" role="alert">
            <p className="text-sm font-bold uppercase tracking-[.14em] text-[#b42318]">
              {studentsResult.error === 'forbidden' ? 'Akses ditolak' : 'Progres tidak tersedia'}
            </p>
            <h1 className="mt-2 text-3xl font-black">Jadwal &amp; progres anak belum dapat dimuat.</h1>
            <p className="mt-3 text-[#52615b]">{studentsResult.message}</p>
          </section>
        </div>
      </main>
    );
  }

  const students = studentsResult.data.items;
  if (students.length === 0) {
    return (
      <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f] sm:px-8">
        <div className="mx-auto max-w-5xl">
          <header className="border-b border-[#dfe3d7] pb-7">
            <p className="text-sm font-bold uppercase tracking-[.16em] text-[#617c35]">Profil parent</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Jadwal &amp; progres anak</h1>
          </header>
          <section className="mt-8 rounded-3xl border border-dashed border-[#c8d0c5] bg-white p-10 text-center">
            <h2 className="text-2xl font-black">Belum ada profil anak.</h2>
            <p className="mx-auto mt-2 max-w-md text-[#52615b]">
              Tambahkan profil anak terlebih dahulu agar jadwal, kehadiran, dan laporannya dapat ditampilkan.
            </p>
            <Link href="/dashboard/parent/students" className="mt-5 inline-block rounded-xl bg-[#617c35] px-5 py-3 font-bold text-white">
              Kelola profil anak
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const selectedId = resolveSelectedStudentId(
    students.map((s) => s.id),
    requestedStudent(params),
  ) as string;

  const [historyResult, sessionsResult, attendanceResult, reportsResult] = await Promise.all([
    getEnrollmentHistory(),
    getUpcomingSessions(selectedId),
    getStudentAttendance(selectedId),
    getStudentReports(selectedId),
  ]);

  const historyError = historyResult.error ? historyResult.message : null;
  const enrollments: ProgressEnrollment[] = historyResult.error
    ? []
    : (historyResult.data.enrollments as unknown as ProgressEnrollment[]);

  const sessions = sessionsResult.error
    ? []
    : sessionsForStudent(sessionsResult.data, enrollments, selectedId);
  const attendance = attendanceResult.error
    ? []
    : attendanceForStudent(attendanceResult.data, enrollments, selectedId);
  const reports = reportsResult.error
    ? []
    : reportsForStudent(reportsResult.data, enrollments, selectedId);
  const summary = summarizeAttendance(attendance);

  return (
    <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[#dfe3d7] pb-7">
          <p className="text-sm font-bold uppercase tracking-[.16em] text-[#617c35]">Profil parent</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.055em]">Jadwal &amp; progres anak</h1>
          <p className="mt-3 max-w-2xl text-[#52615b]">
            Sesi dua minggu ke depan, riwayat kehadiran, dan laporan perkembangan anak.
          </p>
          {students.length > 1 && (
            <div className="mt-5">
              <StudentSelector students={students} selectedId={selectedId} />
            </div>
          )}
        </header>

        {historyError && (
          <section className="mt-8" aria-label="Data enrollment">
            <SectionError message={historyError} />
          </section>
        )}

        <section className="mt-8" aria-label="Sesi mendatang">
          <h2 className="text-2xl font-black">Sesi mendatang</h2>
          <p className="mt-1 text-sm text-[#52615b]">Dua minggu ke depan.</p>
          {sessionsResult.error ? (
            <SectionError message={sessionsResult.message} />
          ) : sessions.length === 0 ? (
            <p className="mt-3 rounded-3xl border border-dashed border-[#c8d0c5] bg-white p-8 text-center text-[#52615b]">
              Belum ada sesi mendatang untuk anak ini.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {sessions.map((session) => (
                <li key={session.id} className="rounded-3xl border border-[#dfe3d7] bg-white p-5">
                  <p className="font-black">{session.class?.name || 'Kelas'}</p>
                  <p className="mt-1 text-sm text-[#52615b]">{formatSessionLabel(session)}</p>
                  {session.status && (
                    <p className="mt-1 inline-block rounded-full bg-[#eef3f1] px-3 py-1 text-xs font-bold text-[#365047]">
                      {session.status}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10" aria-label="Riwayat kehadiran">
          <h2 className="text-2xl font-black">Riwayat kehadiran</h2>
          {attendanceResult.error ? (
            <SectionError message={attendanceResult.message} />
          ) : attendance.length === 0 ? (
            <p className="mt-3 rounded-3xl border border-dashed border-[#c8d0c5] bg-white p-8 text-center text-[#52615b]">
              Belum ada riwayat kehadiran untuk anak ini.
            </p>
          ) : (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Ringkasan kehadiran">
                <div className="rounded-2xl border border-[#dfe3d7] bg-white p-4 text-center">
                  <dt className="text-xs font-bold uppercase text-[#65726c]">Hadir</dt>
                  <dd className="text-2xl font-black">{summary.present}</dd>
                </div>
                <div className="rounded-2xl border border-[#dfe3d7] bg-white p-4 text-center">
                  <dt className="text-xs font-bold uppercase text-[#65726c]">Terlambat</dt>
                  <dd className="text-2xl font-black">{summary.late}</dd>
                </div>
                <div className="rounded-2xl border border-[#dfe3d7] bg-white p-4 text-center">
                  <dt className="text-xs font-bold uppercase text-[#65726c]">Izin</dt>
                  <dd className="text-2xl font-black">{summary.excused}</dd>
                </div>
                <div className="rounded-2xl border border-[#dfe3d7] bg-white p-4 text-center">
                  <dt className="text-xs font-bold uppercase text-[#65726c]">Tidak hadir</dt>
                  <dd className="text-2xl font-black">{summary.absent}</dd>
                </div>
                <div className="rounded-2xl border border-[#dfe3d7] bg-white p-4 text-center">
                  <dt className="text-xs font-bold uppercase text-[#65726c]">Total</dt>
                  <dd className="text-2xl font-black">{summary.total}</dd>
                </div>
              </dl>
              <ul className="mt-4 space-y-3">
                {attendance.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-[#dfe3d7] bg-white p-5">
                    <div>
                      <p className="font-bold">{formatJakartaDate(row.date ?? row.session?.session_date ?? null)}</p>
                      <p className="text-sm text-[#52615b]">
                        {ATTENDANCE_STATUS_LABEL[row.status ?? ''] ?? row.status ?? '—'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="mt-10" aria-label="Laporan">
          <h2 className="text-2xl font-black">Laporan</h2>
          {reportsResult.error ? (
            <SectionError message={reportsResult.message} />
          ) : reports.length === 0 ? (
            <p className="mt-3 rounded-3xl border border-dashed border-[#c8d0c5] bg-white p-8 text-center text-[#52615b]">
              Belum ada laporan untuk anak ini.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reports.map((report) => (
                <li key={report.id} className="rounded-3xl border border-[#dfe3d7] bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{report.title || 'Laporan'}</p>
                      <p className="mt-1 text-sm text-[#52615b]">{formatJakartaDate(report.created_at)}</p>
                    </div>
                    {isProgressUuid(report.id) && (
                      <Link
                        href={`/dashboard/parent/progress/reports/${report.id}?student=${encodeURIComponent(selectedId)}`}
                        className="rounded-xl border border-[#dfe3d7] px-4 py-2 text-sm font-bold text-[#617c35] hover:bg-[#eef4e8]"
                      >
                        Lihat detail
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
