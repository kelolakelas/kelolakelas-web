'use client';

import { RouteErrorState } from '@/app/_components/RouteErrorState';

/**
 * Error boundary for the parent enrollment status screen. Known API failures are still rendered
 * by the page itself; this only catches unexpected render errors. The login link is the recovery
 * path when the failure comes from an expired session.
 */
export default function ParentEnrollmentsError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <RouteErrorState
      title="Status enrollment belum dapat dimuat."
      description="Coba lagi dalam beberapa saat. Jika sesi Anda telah berakhir, masuk kembali untuk melanjutkan."
      digest={error.digest}
      onRetry={unstable_retry}
      secondaryLink={{ href: '/login?redirectTo=%2Fdashboard%2Fparent%2Fenrollments', label: 'Masuk kembali' }}
    />
  );
}
