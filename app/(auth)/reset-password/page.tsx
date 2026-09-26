import type { Metadata } from 'next';
import { ResetPasswordForm } from './_components/ResetPasswordForm';

export const metadata: Metadata = { title: 'Atur ulang password - KelolaKelas', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md space-y-5 rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold" tabIndex={-1}>Atur ulang password</h1>
        {typeof token === 'string' && token.trim() ? <ResetPasswordForm token={token} /> : (
          <div><p role="alert">Tautan reset tidak valid atau sudah kedaluwarsa.</p><a href="/forgot-password" className="text-indigo-700 underline focus-visible:outline-2">Minta tautan baru</a></div>
        )}
      </section>
    </main>
  );
}
