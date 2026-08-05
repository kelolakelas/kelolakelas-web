import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './_components/LoginForm';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Login - Tutorin',
  description: 'Sign in to access your Tutorin account and manage your courses.',
  alternates: {
    canonical: `${appUrl}/login`,
  },
  openGraph: {
    title: 'Login - Tutorin',
    description: 'Sign in to access your Tutorin account and manage your courses.',
    url: `${appUrl}/login`,
    siteName: 'Tutorin',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-2xl bg-white shadow-xl" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
