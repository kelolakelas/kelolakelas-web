/**
 * Client-safe helpers for the tenant class edit flow.
 *
 * The class update Server Action may only export async functions, so the pure
 * decision logic that decides what a failed update tells the tenant lives here
 * where it can be unit tested. The status codes are not interchangeable:
 * `PATCH /api/v1/classes/:id` is guarded by the `class:update` permission, and
 * the academic service deliberately reports a class owned by another tenant as
 * `404` rather than `403` so the endpoint never confirms that a foreign row
 * exists. A `403` therefore always means "your role is missing the permission",
 * while a `404` always means "the class is gone from this tenant".
 */

/** Session is no longer valid, so the update was never authorized. */
const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please sign in again to save your changes.';

/** Caller is authenticated but its role lacks `class:update`. */
export const CLASS_EDIT_FORBIDDEN_MESSAGE =
  'You do not have permission to edit classes. Ask a tenant administrator for the class:update permission.';

/** The class is absent from this tenant: deleted, archived, or never ours. */
const CLASS_GONE_MESSAGE =
  'This class no longer exists. It may have been removed by another member — close this form and refresh the list.';

/** The gateway could not reach the authorization service to check the scope. */
const AUTHORIZATION_UNAVAILABLE_MESSAGE =
  'The authorization service is unavailable, so your permission could not be verified. Please try again shortly.';

/** Fallback when the backend answered without a usable message. */
const GENERIC_FAILURE_MESSAGE =
  'Failed to update the class. Please try again.';

/**
 * Maps a failed class update response onto a message the tenant can act on.
 *
 * The `422` family is passed through verbatim because those messages name the
 * exact rejected value (`class name is required`, `class price must not be
 * negative`, `category not found`, `class type cannot be changed`) and the
 * backend is the only authority on which rule fired. Every other status is
 * translated, because a bare `Permission denied` does not tell the tenant what
 * to do next.
 */
export function classUpdateErrorMessage(
  status: number,
  backendMessage?: string | null
): string {
  if (status === 401) {
    return SESSION_EXPIRED_MESSAGE;
  }

  if (status === 403) {
    return CLASS_EDIT_FORBIDDEN_MESSAGE;
  }

  if (status === 404) {
    return CLASS_GONE_MESSAGE;
  }

  if (status === 503) {
    return AUTHORIZATION_UNAVAILABLE_MESSAGE;
  }

  return backendMessage?.trim() || GENERIC_FAILURE_MESSAGE;
}

/**
 * Coerces a stored class description into the string the edit form shows.
 *
 * The academic service stores `description` as `jsonb`, so the same field can
 * arrive as a plain string or as an object such as `{ "text": "..." }`
 * depending on who wrote it. The edit form only ever writes a plain string, so
 * anything it cannot represent is shown as empty rather than as `[object
 * Object]`. Clearing a description is not possible through the update endpoint,
 * so an empty result here leaves the stored value untouched on save.
 */
export function editableDescriptionText(description: unknown): string {
  if (typeof description === 'string') {
    return description.trim();
  }

  if (
    description !== null &&
    typeof description === 'object' &&
    'text' in description
  ) {
    const text = (description as { text?: unknown }).text;
    return typeof text === 'string' ? text.trim() : '';
  }

  return '';
}
