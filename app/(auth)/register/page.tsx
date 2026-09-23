import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterFormSwitch } from './_components/RegisterFormSwitch';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Register - KelolaKelas',
  description: 'Create a Parent or Organization account on KelolaKelas.',
  alternates: {
    canonical: `${appUrl}/register`,
  },
  openGraph: {
    title: 'Register - KelolaKelas',
    description: 'Create a Parent or Organization account on KelolaKelas.',
    url: `${appUrl}/register`,
    siteName: 'KelolaKelas',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Suspense
        fallback={
          <div className="w-full max-w-xl rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-xl">
            <div className="animate-pulse space-y-4">
              <div className="h-10 rounded-xl bg-gray-200" />
              <div className="h-64 rounded-xl bg-gray-100" />
            </div>
          </div>
        }
      >
        <RegisterFormSwitch />
      </Suspense>
    </main>
  );
}
