export function RolesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="pb-4 border-b border-gray-200 dark:border-gray-800 space-y-2">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        <div className="h-4 w-96 bg-gray-100 dark:bg-gray-800/60 rounded-md" />
      </div>

      {/* Form Card Skeleton */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-800 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-11 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          <div className="h-11 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        </div>
        <div className="h-48 bg-gray-100 dark:bg-gray-800/50 rounded-2xl" />
      </div>

      {/* Role Grid Skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-800 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-40 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded-md" />
                <div className="h-4 w-20 bg-gray-100 dark:bg-gray-800 rounded-full" />
              </div>
              <div className="h-4 w-full bg-gray-100 dark:bg-gray-800/60 rounded-md" />
              <div className="h-4 w-2/3 bg-gray-100 dark:bg-gray-800/60 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
