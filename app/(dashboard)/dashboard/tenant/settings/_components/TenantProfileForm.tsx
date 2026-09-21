'use client';

import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';
import { updateTenantProfile } from '../_actions/settingsActions';
import {
  aboutToText,
  EMPTY_TENANT_SETTINGS_ACTION_STATE,
  type TenantProfile,
} from '../_lib/schema';

/**
 * Submit button for the profile form.
 *
 * Kept as its own component so `useFormStatus` can observe the parent form's
 * pending state; the hook only reports on the form that directly renders it.
 * Disabling while pending is also the double-submit guard: React dispatches one
 * action at a time, and the disabled control stops a second click from queueing.
 */
function SaveButton({ label }: { label: string }) {
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
      {pending ? 'Menyimpan...' : label}
    </button>
  );
}

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900';

/**
 * Reads the profile form fields off the stored tenant.
 *
 * The form is keyed on the tenant id by its parent, so these initialisers run
 * whenever the stored profile changes after a save and the fields always start
 * from the persisted values rather than from a stale render.
 */
export function TenantProfileForm({
  profile,
  readOnly,
}: {
  profile: TenantProfile;
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState(
    updateTenantProfile,
    EMPTY_TENANT_SETTINGS_ACTION_STATE
  );
  const fieldId = useId();

  const nameError = state.errors?.name?.[0];
  const phoneError = state.errors?.phone?.[0];
  const addressError = state.errors?.address?.[0];
  const aboutError = state.errors?.about?.[0];
  const isDenied = state.status === 'forbidden';

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <fieldset disabled={readOnly} className="space-y-4">
        <legend className="sr-only">Profil tenant</legend>

        <div>
          <label
            htmlFor={`${fieldId}-name`}
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Nama tenant
          </label>
          <input
            id={`${fieldId}-name`}
            name="name"
            type="text"
            required
            maxLength={255}
            defaultValue={profile.name}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${fieldId}-name-error` : undefined}
            className={INPUT_CLASS}
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
            htmlFor={`${fieldId}-phone`}
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Telepon
          </label>
          <input
            id={`${fieldId}-phone`}
            name="phone"
            type="tel"
            maxLength={50}
            defaultValue={profile.phone ?? ''}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={phoneError ? `${fieldId}-phone-error` : undefined}
            className={INPUT_CLASS}
          />
          {phoneError && (
            <p
              id={`${fieldId}-phone-error`}
              role="alert"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {phoneError}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={`${fieldId}-address`}
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Alamat
          </label>
          <input
            id={`${fieldId}-address`}
            name="address"
            type="text"
            maxLength={500}
            defaultValue={profile.address ?? ''}
            aria-invalid={addressError ? true : undefined}
            aria-describedby={`${fieldId}-address-hint${addressError ? ` ${fieldId}-address-error` : ''}`}
            className={INPUT_CLASS}
          />
          <p
            id={`${fieldId}-address-hint`}
            className="mt-1 text-xs text-gray-500 dark:text-gray-400"
          >
            Alamat di sini adalah alamat profil. Untuk lokasi pencarian katalog, gunakan
            bagian lokasi di bawah.
          </p>
          {addressError && (
            <p
              id={`${fieldId}-address-error`}
              role="alert"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {addressError}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={`${fieldId}-about`}
            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Tentang tenant
          </label>
          <textarea
            id={`${fieldId}-about`}
            name="about"
            rows={4}
            defaultValue={aboutToText(profile.about)}
            aria-invalid={aboutError ? true : undefined}
            aria-describedby={`${fieldId}-about-hint${aboutError ? ` ${fieldId}-about-error` : ''}`}
            className={INPUT_CLASS}
          />
          <p
            id={`${fieldId}-about-hint`}
            className="mt-1 text-xs text-gray-500 dark:text-gray-400"
          >
            Ditampilkan pada katalog publik. Kosongkan untuk menghapus deskripsi.
          </p>
          {aboutError && (
            <p
              id={`${fieldId}-about-error`}
              role="alert"
              className="mt-1 text-sm text-red-600 dark:text-red-400"
            >
              {aboutError}
            </p>
          )}
        </div>
      </fieldset>

      {state.message && (
        <p
          role={isDenied || state.status === 'error' ? 'alert' : 'status'}
          className={
            state.status === 'success'
              ? 'rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
          }
        >
          {state.message}
        </p>
      )}

      {!readOnly && <SaveButton label="Simpan profil" />}
    </form>
  );
}
