import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClassCreationWizard } from './_components/ClassCreationWizard';
import { ClassListTable } from './_components/ClassListTable';
import { ClassSkeleton } from './_components/ClassSkeleton';
import { getCategories, getClasses, getSchedules } from './_queries/queries';

export const metadata: Metadata = {
  title: 'Class Management - Tenant Dashboard',
  description:
    'Manage subject categories, course classes, capacity, pricing, and weekly schedules for your organization.',
  alternates: {
    canonical: '/dashboard/tenant/classes',
  },
};

/**
 * Async content component wrapped in Suspense boundary for Partial Prerendering (PPR).
 */
async function ClassesContent() {
  const [categories, classes, schedules] = await Promise.all([
    getCategories(),
    getClasses(),
    getSchedules(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Class & Academic Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure subject categories, class pricing, student capacities, and recurring weekly timetables.
          </p>
        </div>

        {/* Wizard Trigger Button */}
        <ClassCreationWizard existingCategories={categories} />
      </div>

      {/* Main Responsive Data Display */}
      <ClassListTable
        categories={categories}
        classes={classes}
        schedules={schedules}
      />
    </div>
  );
}

export default function TenantClassesPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Suspense fallback={<ClassSkeleton />}>
        <ClassesContent />
      </Suspense>
    </main>
  );
}
