'use client';

import { RouteErrorState } from '@/app/_components/RouteErrorState';
import './globals.css';

/**
 * Last-resort boundary for errors thrown by the root layout itself (KEL-48). It replaces the root
 * layout while active, so it renders its own document, imports the global stylesheet, and keeps
 * `lang="id"`. Metadata exports are not supported in a Client Component, so the title is a React
 * `<title>` element.
 */
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="id">
      <body>
        <title>Terjadi kesalahan - KelolaKelas</title>
        <RouteErrorState
          title="KelolaKelas belum dapat dimuat."
          description="Coba lagi dalam beberapa saat. Jika masalah berlanjut, layanan mungkin sedang tidak tersedia."
          digest={error.digest}
          onRetry={unstable_retry}
          secondaryLink={{ href: '/', label: 'Kembali ke beranda' }}
        />
      </body>
    </html>
  );
}
