/**
 * Loading placeholder for the tutor session overview (KEL-137).
 *
 * A Server Component that mirrors the shape of the loaded screen — header,
 * filter card, and session cards — so the layout does not jump when the
 * gateway answers.
 */
export function SessionsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="h-8 w-56 rounded-lg bg-gray-200 dark:bg-gray-800" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-gray-100 dark:bg-gray-800/60" />
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs">
        <div className="h-11 rounded-xl bg-gray-100 dark:bg-gray-800/60" />
      </div>

      <div className="space-y-4">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs"
          >
            <div className="h-5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 h-4 w-64 max-w-full rounded bg-gray-100 dark:bg-gray-800/60" />
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-11 rounded-xl bg-gray-100 dark:bg-gray-800/60" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
