/**
 * Loading placeholder for the tenant enrollment overview (KEL-33).
 *
 * It mirrors the shape of the rendered result — filter bar, then the mobile
 * card list and the desktop table — so the layout does not jump when the
 * gateway reads resolve. Marked `aria-hidden` because a screen reader should
 * hear the page's own loading semantics rather than placeholder bars.
 */
export function EnrollmentsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex flex-col gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="h-8 w-56 rounded-lg bg-gray-200 dark:bg-gray-800 animate-pulse" />
        <div className="h-4 w-full max-w-xl rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
      </div>

      <div className="h-20 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" />

      <div className="space-y-4 md:hidden">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3 animate-pulse"
          >
            <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-6 w-32 rounded-full bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse">
        <div className="h-12 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50" />
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 px-4 py-4 last:border-0"
          >
            <div className="h-5 w-1/4 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-5 w-1/4 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-5 w-1/5 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-6 w-24 rounded-full bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
