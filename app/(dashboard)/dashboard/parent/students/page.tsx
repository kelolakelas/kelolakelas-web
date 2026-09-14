import type { Metadata } from 'next';
import { StudentsManager } from './_components/StudentsManager';
import { getStudents } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Student Saya - KelolaKelas',
  description: 'Kelola profil student milik parent untuk enrollment kelas.',
};

export default async function ParentStudentsPage() {
  const result = await getStudents();

  return (
    <main className="min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        {result.error ? (
          <section className="rounded-3xl border border-[#f2c6c3] bg-white p-8" role="alert">
            <p className="text-sm font-bold uppercase tracking-[.14em] text-[#b42318]">{result.error === 'forbidden' ? 'Akses ditolak' : 'Student tidak tersedia'}</p>
            <h1 className="mt-2 text-3xl font-black">Profil student belum dapat dimuat.</h1>
            <p className="mt-3 text-[#52615b]">{result.message}</p>
          </section>
        ) : <StudentsManager data={result.data} />}
      </div>
    </main>
  );
}
