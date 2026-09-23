/**
 * Shared fallback for route error boundaries (KEL-48).
 *
 * The error boundary files are Client Components, so this module deliberately takes only
 * serialisable display data plus the retry callback. It never renders `error.message`: in
 * production Next.js replaces Server Component messages with a generic string, and in
 * development the message can contain internal details. The `digest` is a hash that matches
 * the server log entry Next.js writes for the same error, so it is safe to show as a
 * reference code and lets support correlate a report with server-side logs.
 */

export type RouteErrorVariant = 'public' | 'dashboard';

type RouteErrorStateProps = {
  title: string;
  description: string;
  digest?: string;
  onRetry: () => void;
  variant?: RouteErrorVariant;
  secondaryLink?: { href: string; label: string };
};

/** A digest is an opaque hash; anything else is not rendered. */
export function referenceCode(digest: string | undefined): string | null {
  if (!digest) return null;
  const trimmed = digest.trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(trimmed) ? trimmed : null;
}

const styles = {
  public: {
    wrapper: 'min-h-screen bg-[#f8f7f3] px-5 py-10 text-[#17231f] sm:px-8 lg:px-10',
    card: 'mx-auto max-w-5xl rounded-3xl border border-[#f2c6c3] bg-white p-8',
    eyebrow: 'text-sm font-bold uppercase tracking-[.14em] text-[#b42318]',
    title: 'mt-2 text-3xl font-black',
    body: 'mt-3 text-[#52615b]',
    code: 'mt-3 text-sm text-[#65726c]',
    primary: 'min-h-11 rounded-xl bg-[#17231f] px-5 font-bold text-white',
    secondary: 'inline-flex min-h-11 items-center rounded-xl border border-[#dfe3d7] bg-white px-5 font-bold text-[#617c35] hover:bg-[#eef4e8]',
  },
  dashboard: {
    wrapper: '',
    card: 'rounded-2xl border border-red-200 bg-white p-6 shadow-xs dark:border-red-900/60 dark:bg-gray-900 sm:p-8',
    eyebrow: 'text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400',
    title: 'mt-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100',
    body: 'mt-2 text-sm text-gray-600 dark:text-gray-400',
    code: 'mt-3 text-xs text-gray-500 dark:text-gray-400',
    primary: 'min-h-[44px] rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    secondary: 'inline-flex min-h-[44px] items-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:text-gray-200',
  },
} as const;

export function RouteErrorState({ title, description, digest, onRetry, variant = 'public', secondaryLink }: RouteErrorStateProps) {
  const s = styles[variant];
  const code = referenceCode(digest);
  const card = (
    <section className={s.card} role="alert">
      <p className={s.eyebrow}>Terjadi kesalahan</p>
      <h1 className={s.title}>{title}</h1>
      <p className={s.body}>{description}</p>
      {code && <p className={s.code}>Kode referensi: <code>{code}</code></p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => onRetry()} className={s.primary}>Coba lagi</button>
        {/* A plain anchor, not next/link: after an error a full navigation is the safest recovery. */}
        {secondaryLink && <a href={secondaryLink.href} className={s.secondary}>{secondaryLink.label}</a>}
      </div>
    </section>
  );
  return variant === 'public' ? <main className={s.wrapper}>{card}</main> : card;
}
