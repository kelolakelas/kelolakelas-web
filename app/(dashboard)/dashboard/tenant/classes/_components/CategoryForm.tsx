'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { createCategory, type ActionResponse } from '../_actions/classActions';
import type { Category } from '../_lib/schema';

// Standard submit button utilizing React 19's useFormStatus
function SubmitCategoryButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Saving Category...
        </span>
      ) : (
        'Create Category'
      )}
    </button>
  );
}

interface CategoryFormProps {
  existingCategories: Category[];
  onSelectCategory: (category: Category) => void;
}

const initialActionState: ActionResponse<Category> = {
  success: false,
  message: '',
};

export function CategoryForm({ existingCategories, onSelectCategory }: CategoryFormProps) {
  const [state, formAction] = useActionState(createCategory, initialActionState);

  useEffect(() => {
    if (state.success && state.data) {
      onSelectCategory(state.data as Category);
    }
  }, [state, onSelectCategory]);

  return (
    <div className="space-y-6">
      {/* Option A: Select from existing categories */}
      {existingCategories.length > 0 && (
        <div className="space-y-3 border-b border-gray-100 dark:border-gray-800 pb-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Select Existing Category
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {existingCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className="flex min-h-[44px] items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-left transition-all hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {cat.name}
                  </p>
                  {cat.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {cat.description}
                    </p>
                  )}
                </div>
                <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs">
                  Select →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Option B: Create new category inline */}
      <form action={formAction} className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {existingCategories.length > 0
              ? 'Or Create a New Category'
              : 'Create New Category'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Categories group related courses together (e.g., Mathematics, Languages).
          </p>
        </div>

        {/* Global Error Banner */}
        {!state.success && state.message && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300">
            {state.message}
          </div>
        )}

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
          {state.errors?.name && (
            <p className="text-xs text-red-600 dark:text-red-400">{state.errors.name[0]}</p>
          )}
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
          {state.errors?.description && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {state.errors.description[0]}
            </p>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <SubmitCategoryButton />
        </div>
      </form>
    </div>
  );
}
