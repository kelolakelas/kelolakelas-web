'use server';

import {
  searchDirectEnrollmentOptions,
  searchTaughtEnrollmentOptions,
  type EnrollmentPickerResult,
} from '../_queries/queries';

/**
 * On-demand enrollment search for the create-form student picker (KEL-167).
 *
 * Thin wrappers so the client picker can search and page without a full
 * route navigation — one explicit backend page per call, never a prefetch.
 * The permission contract is unchanged from the old page-load lookups: the
 * direct list needs `enrollment:read` (Creator path) while the taught
 * lookup needs only `schedule:read` (Teacher path), and the picker probes
 * the direct list first, then falls back when it answers `forbidden`. The
 * report create action still enforces the assignment server-side.
 */
export async function searchDirectEnrollments(
  search: string,
  page: number
): Promise<EnrollmentPickerResult> {
  return searchDirectEnrollmentOptions(search, page);
}

/**
 * On-demand taught-session search for the create-form student picker
 * (KEL-167, Teacher two-step: search matches the class name server-side,
 * then the picker resolves that page's students through attendees).
 */
export async function searchTaughtEnrollments(
  search: string,
  page: number
): Promise<EnrollmentPickerResult> {
  return searchTaughtEnrollmentOptions(search, page);
}
