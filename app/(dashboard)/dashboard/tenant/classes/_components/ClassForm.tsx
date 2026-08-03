'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Category, CategoryDraft, ClassDraft } from '../_lib/schema';

function SubmitClassButton() {
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
          Saving Class...
        </span>
      ) : (
        'Save & Proceed to Scheduling →'
      )}
    </button>
  );
}

interface ClassFormProps {
  selectedCategory: Category | CategoryDraft;
  onClassCreated: (classDraft: ClassDraft) => void;
  onBack: () => void;
}

export function ClassForm({ selectedCategory, onClassCreated, onBack }: ClassFormProps) {
  const [classType, setClassType] = useState<'private' | 'group'>('group');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onClassCreated({
      name: String(formData.get('name') || '').trim(),
      type: classType,
      price: Number(formData.get('price') || 0),
      capacity: formData.get('capacity') ? Number(formData.get('capacity')) : undefined,
      description: String(formData.get('description') || '').trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Category Indicator Banner */}
      <div className="flex items-center justify-between rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 px-4 py-3 text-xs">
        <div>
          <span className="text-gray-500 dark:text-gray-400 block">Selected Category:</span>
          <span className="font-bold text-blue-700 dark:text-blue-300 text-sm">
            {selectedCategory.name}
          </span>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
        >
          Change Category
        </button>
      </div>

      {/* Class Name */}
      <div className="space-y-1.5">
        <label
          htmlFor="class-name"
          className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
        >
          Class / Course Name <span className="text-red-500">*</span>
        </label>
        <input
          id="class-name"
          name="name"
          type="text"
          required
          placeholder="e.g. Physics Grade 10 - Intensive"
          className="block min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Class Type Selector (Private vs Group) */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Class Type <span className="text-red-500">*</span>
        </label>
        <input type="hidden" name="type" value={classType} />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setClassType('group')}
            className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
              classType === 'group'
                ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold ring-2 ring-blue-500/30'
                : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="text-sm">Group Class</span>
            <span className="text-[11px] opacity-75">Multiple Students</span>
          </button>
          <button
            type="button"
            onClick={() => setClassType('private')}
            className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
              classType === 'private'
                ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold ring-2 ring-blue-500/30'
                : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <span className="text-sm">Private 1-on-1</span>
            <span className="text-[11px] opacity-75">Single Student</span>
          </button>
        </div>
      </div>

      {/* Price & Capacity Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Price Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="class-price"
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
          >
            Price (IDR) <span className="text-red-500">*</span>
          </label>
          <div className="relative rounded-xl shadow-xs">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-xs text-gray-500 font-medium">
              Rp
            </span>
            <input
              id="class-price"
              name="price"
              type="number"
              min="0"
              step="1000"
              required
              placeholder="150000"
              className="block min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 pl-10 pr-3.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Capacity Input (relevant mainly for group) */}
        <div className="space-y-1.5">
          <label
            htmlFor="class-capacity"
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
          >
            Max Student Capacity
          </label>
          <input
            id="class-capacity"
            name="capacity"
            type="number"
            min="1"
            defaultValue={classType === 'private' ? 1 : 10}
            placeholder="10"
            className="block min-h-[44px] w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Description Optional */}
      <div className="space-y-1.5">
        <label
          htmlFor="class-description"
          className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"
        >
          Class Summary <span className="text-gray-400 text-[11px] font-normal">(Optional)</span>
        </label>
        <textarea
          id="class-description"
          name="description"
          rows={2}
          placeholder="Brief overview of curriculum or requirements..."
          className="block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Form Action Controls */}
      <div className="pt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          ← Back
        </button>
        <SubmitClassButton />
      </div>
    </form>
  );
}
