'use client';

import { RouteErrorState } from '@/app/_components/RouteErrorState';

/**
 * Error boundary for every tenant dashboard page. It sits in the same segment as the tenant
 * `layout.tsx`, so Next.js renders it inside that layout: the sidebar and mobile navigation stay
 * usable and the member can move to another page without a reload.
 */
export default function TenantDashboardError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <RouteErrorState
      variant="dashboard"
      title="Halaman ini belum dapat dimuat."
      description="Coba lagi, atau pilih halaman lain dari navigasi. Jika sesi Anda telah berakhir, masuk kembali untuk melanjutkan."
      digest={error.digest}
      onRetry={unstable_retry}
      secondaryLink={{ href: '/login?redirectTo=%2Fdashboard%2Ftenant', label: 'Masuk kembali' }}
    />
  );
}
