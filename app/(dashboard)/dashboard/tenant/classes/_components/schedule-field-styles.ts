// Shared by new-slot and saved schedule forms, including native weekday selects.
export const scheduleFieldClass = 'min-w-0 space-y-1';
export const scheduleLabelClass =
  'block text-xs font-semibold text-gray-600 dark:text-gray-400';
export const scheduleControlClass =
  'block h-11 min-h-[44px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-500 dark:aria-invalid:border-red-400 min-w-0 w-full max-w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
export const scheduleDayControlClass = `${scheduleControlClass} appearance-none pr-9`;
export const scheduleTimeGridClass =
  'grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-3';

export const scheduleDayControlStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
};
