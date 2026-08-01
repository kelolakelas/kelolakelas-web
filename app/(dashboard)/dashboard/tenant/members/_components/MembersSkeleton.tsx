export function MembersSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Skeleton Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-4 w-72 bg-gray-100 dark:bg-gray-800 rounded-md"></div>
        </div>
        <div className="h-11 w-36 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
      </div>

      {/* Skeleton Mobile Cards */}
      <div className="block md:hidden space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-4 space-y-3"
          >
            <div className="flex justify-between">
              <div className="space-y-2">
                <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-3 w-40 bg-gray-100 dark:bg-gray-800 rounded"></div>
              </div>
              <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
            <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded"></div>
          </div>
        ))}
      </div>

      {/* Skeleton Desktop Table */}
      <div className="hidden md:block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700/50">
            <div className="space-y-1">
              <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-3 w-56 bg-gray-100 dark:bg-gray-800 rounded"></div>
            </div>
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
            <div className="h-5 w-32 bg-gray-100 dark:bg-gray-800 rounded"></div>
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
