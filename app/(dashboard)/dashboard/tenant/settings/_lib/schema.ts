import { z } from 'zod';

/**
 * Shared schema and pure decision logic for the tenant settings screen.
 *
 * The Server Actions may only export async functions, so everything the tests
 * need to pin lives here: the accepted request shape for the two identity
 * endpoints, and the mapping from a failed response onto what the tenant is
 * told. The backend remains the authority on every rule; the schema mirrors it
 * so an obviously invalid submission never leaves the browser, and a rejection
 * that does arrive is reported with the backend's own message where the backend
 * names the rejected value.
 */

/** `PATCH /api/v1/tenant/settings` accepts a name and three optional facts. */
export const tenantProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama tenant wajib diisi.')
    .max(255, 'Nama tenant maksimal 255 karakter.'),
  phone: optionalText(50, 'Nomor telepon maksimal 50 karakter.'),
  address: optionalText(),
  about: optionalText(),
});

/** `PUT /api/v1/tenant/settings/location` takes an address and optional coordinates. */
export const tenantLocationSchema = z
  .object({
    address: z
      .string()
      .trim()
      .min(1, 'Alamat wajib diisi.')
      .max(500, 'Alamat maksimal 500 karakter.'),
    latitude: optionalCoordinate(-90, 90, 'Latitude harus antara -90 dan 90.'),
    longitude: optionalCoordinate(-180, 180, 'Longitude harus antara -180 dan 180.'),
  })
  .refine(
    (value) => (value.latitude === undefined) === (value.longitude === undefined),
    {
      // identity's `UpdateTenantLocationRequest.Validate` refuses a lone
      // coordinate, so the pair is enforced here too and reported on the field
      // the tenant left blank rather than as a generic form error.
      path: ['longitude'],
      message: 'Latitude dan longitude harus diisi bersamaan.',
    }
  );

export type TenantProfileInput = z.infer<typeof tenantProfileSchema>;
export type TenantLocationInput = z.infer<typeof tenantLocationSchema>;

/** Tenant profile as returned by `GET /api/v1/tenant/settings`. */
export interface TenantProfile {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  address_formatted?: string;
  latitude?: number;
  longitude?: number;
  location_updated_at?: string;
  /**
   * `about` is a JSON column on the backend. The settings endpoint returns
   * whatever shape was stored, so it is carried as an unknown value and
   * interpreted only by `aboutToText`, which never throws on a foreign shape.
   */
  about?: unknown;
}

/** Tenant location as returned by `GET /api/v1/tenant/settings/location`. */
export interface TenantLocation {
  address: string;
  address_formatted?: string;
  latitude?: number;
  longitude?: number;
  location_updated_at?: string;
}

export type TenantSettingsResult =
  | { profile: TenantProfile; location: TenantLocation | null; error: null; message: null }
  | {
      profile: null;
      location: null;
      error: 'forbidden' | 'api' | 'configuration';
      message: string;
    };

export type TenantSettingsFieldErrors = Record<string, string[] | undefined>;

export interface TenantSettingsActionState {
  status: 'idle' | 'success' | 'error' | 'forbidden';
  message: string;
  errors?: TenantSettingsFieldErrors;
}

export const EMPTY_TENANT_SETTINGS_ACTION_STATE: TenantSettingsActionState = {
  status: 'idle',
  message: '',
};

const FORBIDDEN_MESSAGE =
  'Anda tidak memiliki izin mengubah pengaturan tenant. Hubungi administrator tenant untuk mendapatkan permission tenant:update.';

const SESSION_EXPIRED_MESSAGE =
  'Sesi Anda sudah berakhir. Silakan masuk kembali untuk menyimpan perubahan.';

const API_ERROR_MESSAGE =
  'Pengaturan tenant belum dapat dimuat. Coba muat ulang beberapa saat lagi.';

const CONFIGURATION_FALLBACK_MESSAGE =
  'Layanan pengaturan tenant sedang tidak tersedia. Coba lagi nanti.';

export const TENANT_SETTINGS_FORBIDDEN_MESSAGE = FORBIDDEN_MESSAGE;
export const TENANT_SETTINGS_API_ERROR_MESSAGE = API_ERROR_MESSAGE;

/**
 * Builds an optional trimmed string field.
 *
 * An empty submission becomes `undefined` rather than `''` because identity
 * stores these columns as nullable: sending an empty string would overwrite a
 * stored value with a blank one instead of omitting the field.
 */
function optionalText(maxLength = 1_000_000, maxMessage?: string) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    },
    z.string().max(maxLength, maxMessage).optional()
  );
}

/**
 * Builds an optional numeric coordinate field.
 *
 * The form submits text, so an empty string (the untouched input) becomes
 * `undefined` and anything unparseable is a validation error rather than
 * `NaN` reaching the backend.
 */
function optionalCoordinate(minimum: number, maximum: number, message: string) {
  return z.preprocess(
    (value) => {
      if (typeof value === 'number') return value;
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      if (trimmed === '') return undefined;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : trimmed;
    },
    z
      .number({ error: message })
      .min(minimum, message)
      .max(maximum, message)
      .optional()
  );
}

/**
 * Renders the stored `about` value for a textarea.
 *
 * Registration writes `about` as a plain JSON string while other writers may
 * store an object, so both shapes are rendered as text and anything else yields
 * an empty field. The screen must never throw because a row was written by a
 * version of the API it does not know about.
 */
export function aboutToText(about: unknown): string {
  if (typeof about === 'string') return about;
  if (about && typeof about === 'object') {
    return Object.entries(about as Record<string, unknown>)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join('\n');
  }
  return '';
}

/**
 * Converts the textarea back into the JSON value identity stores.
 *
 * A blank field is `undefined` so the field is omitted from the request and the
 * stored value is left alone. Non-blank text is stored as a JSON string, which
 * is the shape registration uses and therefore the shape the catalog already
 * renders.
 */
export function textToAbout(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Whether a read or write was refused for lack of authorization. */
export function isUnauthorizedStatus(status: number): boolean {
  return status === 401;
}

export function isForbiddenStatus(status: number): boolean {
  return status === 403;
}

/**
 * Maps a failed settings response onto the message the tenant sees.
 *
 * `403` is presented as a permission state rather than a failure because the
 * identity service guards both update routes with `tenant:update`: a member
 * without it is expected here. `401` is a session problem, `503` is the
 * authorization lookup being unavailable, and every other status falls back to
 * the backend's own message when it has one, because only the backend knows
 * which validation rule fired.
 */
export function tenantSettingsErrorMessage(
  status: number,
  backendMessage?: string | null,
  fallback: string = API_ERROR_MESSAGE
): string {
  if (isUnauthorizedStatus(status)) return SESSION_EXPIRED_MESSAGE;
  if (isForbiddenStatus(status)) return FORBIDDEN_MESSAGE;
  if (status === 503) {
    return 'Layanan otorisasi sedang tidak tersedia, sehingga permission Anda belum dapat diverifikasi. Coba lagi sebentar lagi.';
  }
  const trimmed = backendMessage?.trim();
  if (trimmed && trimmed !== 'Failed to update tenant settings' && trimmed !== 'Failed to update tenant location') {
    return trimmed;
  }
  return fallback;
}

export const TENANT_SETTINGS_CONFIGURATION_FALLBACK = CONFIGURATION_FALLBACK_MESSAGE;
