'use client';

import { useActionState, useId } from 'react';
import { useFormStatus } from 'react-dom';
import { updateTenantLocation } from '../_actions/settingsActions';
import {
  EMPTY_TENANT_SETTINGS_ACTION_STATE,
  type TenantLocation,
} from '../_lib/schema';

function SaveLocationButton() {
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
      {pending ? 'Menyimpan...' : 'Simpan lokasi'}
    </button>
  );
}

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-900';

function formatCoordinate(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

/**
 * Renders the stored location, including whatever the backend decided.
 *
 * `address_formatted` and the coordinates are shown read-only rather than as
 * form fields: they are the backend's answer after geocoding, not input. A
 * tenant that types a new address sees the result change after the save instead
 * of being asked to interpret the values the geocoder produced.
 */
function StoredLocationSummary({ location }: { location: TenantLocation | null }) {
  if (!location) {
    return (
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
        Lokasi belum diatur. Isi alamat di bawah agar kelas tenant tampil pada pencarian
        katalog berbasis radius.
      </p>
    );
  }

  const hasCoordinates = location.latitude !== undefined && location.longitude !== undefined;

  return (
    <dl className="space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900">
      <div className="flex flex-wrap gap-x-2">
        <dt className="font-medium text-gray-700 dark:text-gray-300">Alamat tersimpan:</dt>
        <dd className="text-gray-600 dark:text-gray-400">{location.address}</dd>
      </div>
      {location.address_formatted && location.address_formatted !== location.address && (
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium text-gray-700 dark:text-gray-300">
            Hasil geocode:
          </dt>
          <dd className="text-gray-600 dark:text-gray-400">
            {location.address_formatted}
          </dd>
        </div>
      )}
      <div className="flex flex-wrap gap-x-2">
        <dt className="font-medium text-gray-700 dark:text-gray-300">Koordinat:</dt>
        <dd className="text-gray-600 dark:text-gray-400">
          {hasCoordinates
            ? `${location.latitude}, ${location.longitude}`
            : 'Belum ada. Sistem akan mencari koordinat dari alamat saat disimpan.'}
        </dd>
      </div>
    </dl>
  );
}

/**
 * Location form.
 *
 * Coordinates are optional as a pair: leaving both blank asks the backend to
 * geocode the address, and filling both stores the values as given. A lone
 * coordinate is refused before it reaches the API because identity validates the
 * same rule, and a round trip would only report it later.
 */
export function TenantLocationForm({
  location,
  readOnly,
}: {
  location: TenantLocation | null;
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState(
    updateTenantLocation,
    EMPTY_TENANT_SETTINGS_ACTION_STATE
  );
  const fieldId = useId();

  const addressError = state.errors?.address?.[0];
  const latitudeError = state.errors?.latitude?.[0];
  const longitudeError = state.errors?.longitude?.[0];
  const isDenied = state.status === 'forbidden';

  return (
    <div className="space-y-4">
      <StoredLocationSummary location={location} />

      <form action={formAction} className="space-y-4" noValidate>
        <fieldset disabled={readOnly} className="space-y-4">
          <legend className="sr-only">Lokasi tenant</legend>

          <div>
            <label
              htmlFor={`${fieldId}-address`}
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Alamat lokasi
            </label>
            <input
              id={`${fieldId}-address`}
              name="address"
              type="text"
              required
              maxLength={500}
              defaultValue={location?.address ?? ''}
              aria-invalid={addressError ? true : undefined}
              aria-describedby={`${fieldId}-address-hint${addressError ? ` ${fieldId}-address-error` : ''}`}
              className={INPUT_CLASS}
            />
            <p
              id={`${fieldId}-address-hint`}
              className="mt-1 text-xs text-gray-500 dark:text-gray-400"
            >
              Isi alamat saja untuk meminta sistem mencari koordinat, atau lengkapi
              koordinat di bawah bila sudah diketahui.
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${fieldId}-latitude`}
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Latitude (opsional)
              </label>
              <input
                id={`${fieldId}-latitude`}
                name="latitude"
                type="text"
                inputMode="decimal"
                defaultValue={formatCoordinate(location?.latitude)}
                aria-invalid={latitudeError ? true : undefined}
                aria-describedby={latitudeError ? `${fieldId}-latitude-error` : undefined}
                className={INPUT_CLASS}
              />
              {latitudeError && (
                <p
                  id={`${fieldId}-latitude-error`}
                  role="alert"
                  className="mt-1 text-sm text-red-600 dark:text-red-400"
                >
                  {latitudeError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor={`${fieldId}-longitude`}
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Longitude (opsional)
              </label>
              <input
                id={`${fieldId}-longitude`}
                name="longitude"
                type="text"
                inputMode="decimal"
                defaultValue={formatCoordinate(location?.longitude)}
                aria-invalid={longitudeError ? true : undefined}
                aria-describedby={longitudeError ? `${fieldId}-longitude-error` : undefined}
                className={INPUT_CLASS}
              />
              {longitudeError && (
                <p
                  id={`${fieldId}-longitude-error`}
                  role="alert"
                  className="mt-1 text-sm text-red-600 dark:text-red-400"
                >
                  {longitudeError}
                </p>
              )}
            </div>
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

        {!readOnly && <SaveLocationButton />}
      </form>
    </div>
  );
}
