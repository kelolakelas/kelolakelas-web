'use client';

import type { FormEvent } from 'react';
import type { CategoryDraft } from '../_lib/schema';

// Standard submit button utilizing React 19's useFormStatus
function SubmitCategoryButton() {
  return (
    <button
      type="submit"
      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      Create Category
    </button>
  );
}

interface CategoryFormProps {
  onCreateCategory: (category: CategoryDraft) => void;
}

export function CategoryForm({
  onCreateCategory,
}: CategoryFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onCreateCategory({
      name: String(formData.get('name') || '').trim(),
      description: String(formData.get('description') || '').trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Create New Category
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Categories group related courses together (e.g., Mathematics, Languages).
          </p>
        </div>

        {/* Category Name Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="category-name"
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
          >
            Category Name <span className="text-red-500">*</span>
          </label>
          <input
            id="category-name"
            name="name"
            type="text"
            required
            placeholder="e.g. Science & Mathematics"
            className="block min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Description Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="category-description"
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
          >
            Description <span className="text-gray-400 text-[11px] font-normal">(Optional)</span>
          </label>
          <textarea
            id="category-description"
            name="description"
            rows={2}
            placeholder="Brief details about courses in this category..."
            className="block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="pt-2 flex justify-end">
          <SubmitCategoryButton />
        </div>
      </form>
    </div>
  );
}
