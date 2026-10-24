/** null means unavailable/loading, distinct from confirmed zero. */
export function NavigationBadge({ count, label = 'pesan belum dibaca' }: { count: number | null; label?: string }) {
  if (count === 0) return null;
  const text = count === null ? '…' : count >= 100 ? '99+' : String(count);
  const description = count === null ? `Jumlah ${label} belum tersedia` : `${count >= 100 ? '100 atau lebih' : count} ${label}`;
  return (
    <span role="status" className="ml-1 inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold leading-4 text-white" aria-label={description} title={description}>
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
