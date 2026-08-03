'use client';

import { useState } from 'react';
import { deleteCategory, deleteClass, deleteSchedule } from '../_actions/classActions';
import type { Category, ClassEntity, ClassSchedule } from '../_lib/schema';
import { ClassCreationWizard } from './ClassCreationWizard';
import { DeleteActionButton } from './DeleteActionButton';

interface ClassListTableProps {
  categories: Category[];
  classes: ClassEntity[];
  schedules: ClassSchedule[];
}

const DAY_NAMES: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ClassListTable({
  categories,
  classes,
  schedules,
}: ClassListTableProps) {
  const [activeTab, setActiveTab] = useState<'classes' | 'categories' | 'schedules'>('classes');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter classes based on search query
  const filteredClasses = classes.filter((cls) => {
    const q = searchQuery.toLowerCase();
    const matchName = cls.name.toLowerCase().includes(q);
    const matchCat = cls.category?.name?.toLowerCase().includes(q) || false;
    return matchName || matchCat;
  });

  if (classes.length === 0 && categories.length === 0 && schedules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 sm:p-12 text-center shadow-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mb-4 shadow-xs">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          No Classes Configured Yet
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md">
          Get started by adding your academic categories, creating your first class, and setting up weekly schedules.
        </p>
        <div className="mt-6">
          <ClassCreationWizard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar: Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* View Switcher Tabs */}
        <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab('classes')}
            className={`min-h-[44px] sm:min-h-[36px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'classes'
                ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Classes ({classes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`min-h-[44px] sm:min-h-[36px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'categories'
                ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Categories ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schedules')}
            className={`min-h-[44px] sm:min-h-[36px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'schedules'
                ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Schedules ({schedules.length})
          </button>
        </div>

        {/* Search Input */}
        {activeTab === 'classes' && (
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search classes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Tab Content 1: Classes List */}
      {activeTab === 'classes' && (
        <>
          {/* Mobile Stacked Cards Layout (block on mobile, hidden on md) */}
          <div className="block md:hidden space-y-3">
            {filteredClasses.map((cls) => (
              <div
                key={cls.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                      {cls.name}
                    </h4>
                    {cls.category?.name && (
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {cls.category.name}
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                      cls.type === 'group'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}
                  >
                    {cls.type}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-[11px]">
                      Price
                    </span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(cls.price)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-[11px]">
                      Capacity
                    </span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {cls.capacity ? `${cls.capacity} Students` : '1 Student'}
                    </span>
                  </div>
                </div>

                {cls.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 pt-1">
                    {cls.description}
                  </p>
                )}
                <div className="flex justify-end border-t border-gray-100 pt-2 dark:border-gray-800">
                  <DeleteActionButton
                    id={cls.id}
                    label="class"
                    action={deleteClass}
                    description="Class akan dinonaktifkan. Schedule aktif terkait ikut dinonaktifkan, enrollment dan session historis tetap tersimpan, sedangkan session mendatang akan dibatalkan."
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Data Table Layout (hidden on mobile, table on md) */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3.5 font-bold">
                    Class Name
                  </th>
                  <th scope="col" className="px-6 py-3.5 font-bold">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3.5 font-bold">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3.5 font-bold">
                    Price
                  </th>
                  <th scope="col" className="px-6 py-3.5 font-bold">
                    Capacity
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredClasses.map((cls) => (
                  <tr
                    key={cls.id}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                      {cls.name}
                    </td>
                    <td className="px-6 py-4">
                      {cls.category?.name ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                          {cls.category.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase ${
                          cls.type === 'group'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {cls.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(cls.price)}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium">
                      {cls.capacity ? `${cls.capacity} max` : '1 max'}
                    </td>
                    <td className="px-6 py-2 text-right">
                      <DeleteActionButton
                        id={cls.id}
                        label="class"
                        action={deleteClass}
                        description="Class akan dinonaktifkan. Schedule aktif terkait ikut dinonaktifkan, enrollment dan session historis tetap tersimpan, sedangkan session mendatang akan dibatalkan."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab Content 2: Categories List */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs space-y-1.5"
            >
              <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {cat.name}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {cat.description || 'No description provided.'}
              </p>
              <div className="flex justify-end pt-1">
                <DeleteActionButton
                  id={cat.id}
                  label="category"
                  action={deleteCategory}
                  description="Category akan dihapus dan tidak dapat dihapus jika masih memiliki class aktif."
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content 3: Schedules List */}
      {activeTab === 'schedules' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {schedules.map((sched) => (
            <div
              key={sched.id}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                  {DAY_NAMES[sched.day_of_week] || `Day ${sched.day_of_week}`}
                </span>
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {sched.start_time.substring(0, 5)} - {sched.end_time.substring(0, 5)}
                </span>
              </div>
              {sched.location && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  📍 {sched.location}
                </p>
              )}
              <div className="flex justify-end border-t border-gray-100 pt-1 dark:border-gray-800">
                <DeleteActionButton
                  id={sched.id}
                  label="schedule"
                  action={deleteSchedule}
                  description="Schedule akan dinonaktifkan. Session historis tetap tersimpan, sedangkan session mendatang akan dibatalkan."
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
