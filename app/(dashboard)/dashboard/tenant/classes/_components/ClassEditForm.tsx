'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateClass, type ActionResponse } from '../_actions/classActions';
import type { Category, ClassEntity } from '../_lib/schema';
import { editableDescriptionText } from '@/lib/class-edit';

/**
 * Submit button for the edit form.
 *
 * Kept as its own component so `useFormStatus` can observe the parent form's
 * pending state; the hook only reports on the form that directly renders it.
 */
function SaveClassButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
        />
      )}
      {pending ? 'Saving Class...' : label}
    </button>
  );
}

interface ClassEditFormProps {
  /** The class being edited; supplies the current values for every field. */
  classRecord: ClassEntity;
  /**
   * Categories available for reassignment. Passed in rather than fetched here
   * so a category created while this form is open appears without a reload.
   */
  categories: Category[];
  /** Called after a successful save so the caller can close the modal. */
  onUpdated?: () => void;
}

/**
 * Form for editing the attributes a tenant may change on an existing class.
 *
 * The field set and validation deliberately mirror the creation wizard for the
 * attributes that are editable. Class type is immutable on the backend and is
 * therefore not rendered at all, and capacity is not part of the class update
 * contract, so neither is submitted — the update endpoint treats an omitted
 * field as "leave unchanged".
 *
 * Price is a text input rather than a number input because tenants type grouped
 * amounts such as `Rp 1.500.000`; the shared schema normalises those forms.
 */
export function ClassEditForm({
  classRecord,
  categories,
  onUpdated,
}: ClassEditFormProps) {
  const initialActionState: ActionResponse<ClassEntity> = {
    success: false,
    message: '',
  };
  const [state, formAction] = useActionState(updateClass, initialActionState);
  const fieldId = useId();

  // The form is unmounted while the modal is closed, so these initialisers run
  // again on every open and the fields always start from the stored class. No
  // effect re-seeds them: a revalidated list must not overwrite what the tenant
  // is currently typing.
  const [name, setName] = useState(classRecord.name);
  const [price, setPrice] = useState(String(classRecord.price));
  const [description, setDescription] = useState(
    editableDescriptionText(classRecord.description)
  );
  const [categoryId, setCategoryId] = useState(classRecord.category_id);

  useEffect(() => {
    if (state.success) {
      onUpdated?.();
    }
  }, [state.success, onUpdated]);

  const nameError = state.errors?.name?.[0];
  const priceError = state.errors?.price?.[0];
  const categoryError = state.errors?.category_id?.[0];
  const descriptionError = state.errors?.description?.[0];

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="class_id" value={classRecord.id} />

      <div>
        <label
          htmlFor={`${fieldId}-name`}
          className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Class Name
        </label>
        <input
          id={`${fieldId}-name`}
          name="name"
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${fieldId}-name-error` : undefined}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        {nameError && (
          <p
            id={`${fieldId}-name-error`}
            role="alert"
            className="mt-1 text-sm text-red-600 dark:text-red-400"
          >
            {nameError}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor={`${fieldId}-category`}
          className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Category
        </label>
        <select
          id={`${fieldId}-category`}
          name="category_id"
          required
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          aria-invalid={categoryError ? true : undefined}
          aria-describedby={categoryError ? `${fieldId}-category-error` : undefined}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {categoryError && (
          <p
            id={`${fieldId}-category-error`}
            role="alert"
            className="mt-1 text-sm text-red-600 dark:text-red-400"
          >
            {categoryError}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor={`${fieldId}-price`}
          className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Price
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500 dark:text-gray-400">
            Rp
          </span>
          <input
            id={`${fieldId}-price`}
            name="price"
            type="text"
            inputMode="numeric"
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            aria-invalid={priceError ? true : undefined}
            aria-describedby={
              priceError ? `${fieldId}-price-error` : `${fieldId}-price-hint`
            }
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        {priceError ? (
          <p
            id={`${fieldId}-price-error`}
            role="alert"
            className="mt-1 text-sm text-red-600 dark:text-red-400"
          >
            {priceError}
          </p>
        ) : (
          <p
            id={`${fieldId}-price-hint`}
            className="mt-1 text-xs text-gray-500 dark:text-gray-400"
          >
            Rupiah only. Grouped amounts such as 1.500.000 are accepted.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor={`${fieldId}-description`}
          className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Description
        </label>
        <textarea
          id={`${fieldId}-description`}
          name="description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={
            descriptionError ? `${fieldId}-description-error` : undefined
          }
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        {descriptionError && (
          <p
            id={`${fieldId}-description-error`}
            role="alert"
            className="mt-1 text-sm text-red-600 dark:text-red-400"
          >
            {descriptionError}
          </p>
        )}
      </div>

      {state.message && (
        <p
          role={state.success ? 'status' : 'alert'}
          className={`rounded-lg px-3 py-2 text-sm ${
            state.success
              ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'
              : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <SaveClassButton label="Save Changes" />
      </div>
    </form>
  );
}
