export function ClassSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-4 w-72 bg-gray-200 dark:bg-gray-800 rounded-md" />
        </div>
        <div className="h-11 w-36 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>

      {/* Control Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="h-11 w-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        <div className="h-11 w-48 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>

      {/* Cards/Table Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded-md" />
              <div className="h-5 w-16 bg-gray-200 dark:bg-gray-800 rounded-md" />
            </div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded-md" />
            <div className="pt-2 flex justify-between">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded-md" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-800 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
