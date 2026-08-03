'use client';

import { startTransition, useActionState, useEffect, useState } from 'react';
import { createClassSetup, type ActionResponse } from '../_actions/classActions';
import type { Category, CategoryDraft, ClassDraft, ScheduleItemInput } from '../_lib/schema';
import { CategoryForm } from './CategoryForm';
import { ClassForm } from './ClassForm';
import { ScheduleForm } from './ScheduleForm';

interface ClassCreationWizardProps {
  onComplete?: () => void;
}

export function ClassCreationWizard({
  onComplete,
}: ClassCreationWizardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [selectedCategory, setSelectedCategory] = useState<(Category | CategoryDraft) | null>(null);
  const [createdClass, setCreatedClass] = useState<ClassDraft | null>(null);
  const [commitState, commitAction, isSubmitting] = useActionState<ActionResponse, FormData>(
    createClassSetup,
    { success: false, message: '' }
  );

  const handleOpen = () => {
    setStep(1);
    setSelectedCategory(null);
    setCreatedClass(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setStep(1);
    setSelectedCategory(null);
    setCreatedClass(null);
  };

  const handleCategorySelected = (category: Category | CategoryDraft) => {
    setSelectedCategory(category);
    setStep(2);
  };

  const handleClassCreated = (classDraft: ClassDraft) => {
    setCreatedClass(classDraft);
    setStep(3);
  };

  const handleScheduleComplete = (schedules: ScheduleItemInput[]) => {
    if (!selectedCategory || !createdClass) return;
    const formData = new FormData();
    formData.set('category', JSON.stringify(selectedCategory));
    formData.set('class', JSON.stringify(createdClass));
    formData.set('schedules', JSON.stringify(schedules));
    startTransition(() => {
      commitAction(formData);
    });
  };

  useEffect(() => {
    if (!commitState.success) return;
    onComplete?.();
  }, [commitState.success, onComplete]);

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>Create New Class</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-6 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Class Creation Wizard
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Set up academic categories, course details, and recurring timetables in 3 easy steps.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Stepper Progress Bar (Mobile-First responsive indicator) */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {/* Step 1 Indicator */}
                <div
                  className={`h-2 rounded-full transition-all ${
                    step >= 1 ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-800'
                  }`}
                />
                {/* Step 2 Indicator */}
                <div
                  className={`h-2 rounded-full transition-all ${
                    step >= 2 ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-800'
                  }`}
                />
                {/* Step 3 Indicator */}
                <div
                  className={`h-2 rounded-full transition-all ${
                    step >= 3 ? 'bg-emerald-600' : 'bg-gray-200 dark:bg-gray-800'
                  }`}
                />
              </div>

              <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-0.5">
                <span className={step === 1 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>
                  1. Category
                </span>
                <span className={step === 2 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>
                  2. Class Details
                </span>
                <span className={step === 3 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                  3. Schedules
                </span>
              </div>
            </div>

            {/* Step Body Content */}
            <div className="py-2">
              {step === 1 && (
                <CategoryForm
                  onCreateCategory={handleCategorySelected}
                />
              )}

              {step === 2 && selectedCategory && (
                <ClassForm
                  selectedCategory={selectedCategory}
                  onClassCreated={handleClassCreated}
                  onBack={() => setStep(1)}
                />
              )}

              {step === 3 && createdClass && (
                <ScheduleForm
                  createdClass={createdClass}
                  onScheduleSuccess={handleScheduleComplete}
                  onBack={() => setStep(2)}
                  isSubmitting={isSubmitting}
                  errorMessage={!commitState.success ? commitState.message : undefined}
                  successMessage={commitState.success ? commitState.message : undefined}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
