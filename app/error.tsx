'use client';

import { RouteErrorState } from '@/app/_components/RouteErrorState';

/**
 * Catch-all boundary for segments without a closer `error.tsx` (landing page, auth pages, and
 * errors thrown by nested layouts). It renders inside the root layout; errors in the root layout
 * itself are handled by `global-error.tsx`.
 */
export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <RouteErrorState
      title="Halaman ini belum dapat ditampilkan."
      description="Coba lagi dalam beberapa saat. Jika masalah berlanjut, layanan mungkin sedang tidak tersedia."
      digest={error.digest}
      onRetry={unstable_retry}
      secondaryLink={{ href: '/', label: 'Kembali ke beranda' }}
    />
  );
}
