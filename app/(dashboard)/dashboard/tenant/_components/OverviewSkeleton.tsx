export function OverviewMetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-5 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-10 w-10 bg-gray-100 dark:bg-gray-700 rounded-xl" />
          </div>
          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      ))}
    </div>
  );
}

export function OverviewContentSkeleton() {
  return (
    <div className="space-y-6">
      <OverviewMetricsSkeleton />

      {/* Grid for Quick Actions and Recent Activity Skeletons */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 animate-pulse">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 space-y-4">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full bg-gray-100 dark:bg-gray-700/50 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-6 space-y-4">
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-full bg-gray-100 dark:bg-gray-700/50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
