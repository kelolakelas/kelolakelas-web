import type { Metadata } from 'next';
import { RequestResetForm } from './_components/RequestResetForm';

export const metadata: Metadata = { title: 'Lupa password - KelolaKelas', robots: { index: false } };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-md space-y-5 rounded-xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold" tabIndex={-1}>Lupa password?</h1>
        {sent === '1' ? <p role="status" tabIndex={-1}>Jika alamat email terdaftar, kami akan mengirim tautan untuk mengatur ulang password.</p> : <RequestResetForm />}
        <a href="/login" className="block text-indigo-700 underline focus-visible:outline-2">Kembali ke login</a>
      </section>
    </main>
  );
}
