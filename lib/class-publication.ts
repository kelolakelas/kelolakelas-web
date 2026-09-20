/**
 * Presentation helpers for the class publication and enrollment state shown in
 * the tenant dashboard.
 *
 * The academic service returns `is_published` (boolean) and `enrollment_status`
 * (`open | closed | full | archived`) on every class payload. A class is listed
 * as enrollable in `/kelas` only when it is published *and* open for enrollment,
 * so both fields have to be surfaced together to explain catalog visibility.
 */

export type ClassPublicationTone = 'neutral' | 'success' | 'warning' | 'danger';

export type ClassEnrollmentStatus = 'open' | 'closed' | 'full' | 'archived';

export interface ClassPublicationFields {
  is_published?: boolean | null;
  enrollment_status?: string | null;
}

export interface ClassPublicationPresentation {
  /** Base publication state of the class. */
  label: string;
  /** Short explanation of the catalog visibility implied by both fields. */
  detail: string;
  tone: ClassPublicationTone;
  enrollmentLabel: string;
  enrollmentTone: ClassPublicationTone;
}

const ENROLLMENT_STATUSES: readonly ClassEnrollmentStatus[] = [
  'open',
  'closed',
  'full',
  'archived',
];

const ENROLLMENT_PRESENTATION: Record<
  ClassEnrollmentStatus,
  { label: string; tone: ClassPublicationTone }
> = {
  open: { label: 'Open for enrollment', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
  full: { label: 'Full', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
};

/**
 * Coerces an untrusted `enrollment_status` into a known value, or `null` when
 * the backend sends something this client does not recognise.
 */
export function normalizeEnrollmentStatus(
  value: unknown
): ClassEnrollmentStatus | null {
  return typeof value === 'string' &&
    (ENROLLMENT_STATUSES as readonly string[]).includes(value)
    ? (value as ClassEnrollmentStatus)
    : null;
}

/** A class is published only when the backend explicitly says `true`. */
export function isClassPublished(
  record: ClassPublicationFields | null | undefined
): boolean {
  return record?.is_published === true;
}

export function enrollmentStatusPresentation(value: unknown): {
  label: string;
  tone: ClassPublicationTone;
} {
  const status = normalizeEnrollmentStatus(value);

  if (!status) {
    return { label: 'Unknown enrollment status', tone: 'neutral' };
  }

  return ENROLLMENT_PRESENTATION[status];
}

export function classPublicationPresentation(
  record: ClassPublicationFields | null | undefined
): ClassPublicationPresentation {
  const published = isClassPublished(record);
  const openForEnrollment =
    normalizeEnrollmentStatus(record?.enrollment_status) === 'open';
  const enrollment = enrollmentStatusPresentation(record?.enrollment_status);

  let detail: string;
  if (!published) {
    detail = 'Hidden from /kelas until it is published.';
  } else if (openForEnrollment) {
    detail = 'Visible in /kelas and open for enrollment.';
  } else {
    detail = 'Visible in /kelas but not open for enrollment.';
  }

  return {
    label: published ? 'Published' : 'Draft',
    detail,
    tone: published ? 'success' : 'warning',
    enrollmentLabel: enrollment.label,
    enrollmentTone: enrollment.tone,
  };
}

/** Label for the button that flips the current publication state. */
export function classPublicationActionLabel(
  record: ClassPublicationFields | null | undefined
): string {
  return isClassPublished(record) ? 'Unpublish' : 'Publish';
}

/** The publication value the toggle should submit next. */
export function classPublicationNextValue(
  record: ClassPublicationFields | null | undefined
): boolean {
  return !isClassPublished(record);
}
