'use client';

import { RouteErrorState } from '@/app/_components/RouteErrorState';

/** Error boundary for the public catalog: covers `/kelas` and `/kelas/[id]`. */
export default function CatalogError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <RouteErrorState
      title="Katalog kelas belum dapat ditampilkan."
      description="Coba lagi dalam beberapa saat. Jika masalah berlanjut, layanan katalog mungkin sedang tidak tersedia."
      digest={error.digest}
      onRetry={unstable_retry}
      secondaryLink={{ href: '/', label: 'Kembali ke beranda' }}
    />
  );
}
