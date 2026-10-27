'use client';
export function ChatReadError({ message }: { message: string }) {
  return <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
    <p role="alert">{message}</p>
    <button type="button" className="min-h-11 rounded-lg border px-4 font-semibold" onClick={() => window.location.reload()}>Coba lagi</button>
  </div>;
}
