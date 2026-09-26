import { z } from 'zod';

/**
 * Category validation schema for creating academic subject/course category.
 * API Reference: POST /api/v1/categories
 */
export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required')
    .max(100, 'Category name cannot exceed 100 characters'),
  description: z.string().trim().optional(),
});

/**
 * Category a class belongs to. Shared by creation and update so both paths
 * reject an unselected category with the same message.
 */
const classCategoryField = z.string().trim().min(1, 'Please select a valid category');

/**
 * Human-readable class name. Shared by creation and update so the editable
 * name is validated identically to the name entered in the creation wizard.
 */
const classNameField = z
  .string()
  .trim()
  .min(1, 'Class name is required')
  .max(100, 'Class name cannot exceed 100 characters');

/**
 * Optional free-text class summary. Shared by creation and update; a blank
 * value is a legitimate submission on both paths.
 */
const classDescriptionField = z.string().trim().optional();

/**
 * Digit groups a tenant may type between thousands separators.
 *
 * Indonesian conventions group thousands with a dot, a comma, or a space
 * (`1.500.000`, `1,500,000`, `1 500 000`), and a tenant may also paste a value
 * that still carries the currency prefix the list renders (`Rp 150.000`). Every
 * accepted grouping is stripped before the value is parsed so a separator can
 * never be mistaken for a decimal point.
 */
const GROUPED_AMOUNT_PATTERN = /^-?(?:\d{1,3}(?:[.,\s]\d{3})+|\d+)$/;

/**
 * Parses a tenant-typed rupiah amount into a whole number.
 *
 * Class prices are stored as `bigint` whole rupiah in the academic service, so
 * this deliberately rejects fractional input rather than rounding it: `1.50`
 * and `1500.00` are refused because a dot is only ever read as a thousands
 * separator. Values outside the safe-integer range are refused too, because
 * IEEE-754 cannot represent them exactly and a lossy price must never be sent.
 *
 * Returns `null` for anything that is not a whole safe amount, which lets the
 * caller surface a single field-scoped message.
 */
export function parseRupiahAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) ? raw : null;
  }

  if (typeof raw !== 'string') {
    return null;
  }

  const withoutCurrency = raw.trim().replace(/^(?:rp\.?|idr)\s*/i, '');

  if (!GROUPED_AMOUNT_PATTERN.test(withoutCurrency)) {
    return null;
  }

  const value = Number(withoutCurrency.replace(/[.,\s]/g, ''));

  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Class price in whole rupiah.
 *
 * The form field is a text input so it can carry thousands separators, which
 * means the raw string has to survive validation. `parseRupiahAmount` runs
 * inside a `transform`/`pipe` pair rather than `z.coerce.number()` because
 * `Number('1.500.000')` is `NaN` and `Number('1.50')` is `1.5`: coercing would
 * silently reject the former and silently misread the latter.
 */
const classPriceField = z
  .union([z.number(), z.string()], {
    message: 'Enter the price as a number, for example 150000',
  })
  .transform((value) => parseRupiahAmount(value))
  .pipe(
    z
      .number({ message: 'Enter the price as a number, for example 150000' })
      .int('Price must be a whole rupiah amount')
      .min(0, 'Price cannot be negative')
  );

/**
 * Class validation schema for creating a new class under a category.
 * API Reference: POST /api/v1/classes
 */
export const createClassSchema = z.object({
  category_id: classCategoryField,
  name: classNameField,
  type: z.enum(['private', 'group'], {
    message: 'Class type must be either private or group',
  }),
  price: z.coerce
    .number({ message: 'Price must be a number' })
    .min(0, 'Price cannot be negative'),
  capacity: z.coerce
    .number({ message: 'Capacity must be a number' })
    .int('Capacity must be an integer')
    .min(1, 'Capacity must be at least 1')
    .optional(),
  description: classDescriptionField,
});

/**
 * Class validation schema for editing an existing class.
 * API Reference: PATCH /api/v1/classes/:id
 *
 * Only the sellable attributes the update endpoint accepts are editable, and
 * they reuse the same fields as the creation wizard. `type` and `capacity` are
 * intentionally absent: the academic service refuses a class-type change with
 * `422 class type cannot be changed` because schedules, sessions, and
 * enrollments were created against the stored type, and `capacity` is deprecated
 * in favour of the schedule capacity. The object is strict so a submission that
 * carries either field fails loudly here instead of being forwarded and turned
 * into an opaque backend error.
 */
export const updateClassSchema = z.strictObject({
  class_id: z.string().trim().min(1, 'Please select a valid class'),
  category_id: classCategoryField,
  name: classNameField,
  price: classPriceField,
  description: classDescriptionField,
});

/**
 * Enrollment status values accepted by the academic service.
 * See POST/PATCH /api/v1/classes.
 */
export const enrollmentStatusSchema = z.enum(['open', 'closed', 'full', 'archived']);

/**
 * Publication toggle payload for a class.
 * API Reference: PATCH /api/v1/classes/:id/published
 */
export const updateClassPublicationSchema = z.object({
  class_id: z.string().trim().min(1, 'Please select a valid class'),
  is_published: z.boolean({
    message: 'Publication state must be either published or unpublished',
  }),
});

/**
 * Time regex format validation (HH:MM or HH:MM:SS)
 */
const timeFormatRegex = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * Per-slot class capacity as a positive integer.
 *
 * The academic service requires `capacity` with `min=1` on every schedule item
 * (`ScheduleItemRequest`, binding `required,min=1`) and stores it on the
 * schedule row, so a payload without it is rejected before the usecase runs.
 * There is deliberately no upper bound: the backend has none, and very large
 * capacities stay valid as long as they are positive integers. The field is
 * typed to accept the string an `<input type="number">` submits and coerce it,
 * so the four invalid shapes the tenant can produce (empty, 0, negative,
 * fractional) each fail with a message that names the fix.
 */
const scheduleCapacityField = z.coerce
  .number({ message: 'Capacity is required' })
  .int('Capacity must be a whole number')
  .min(1, 'Capacity must be at least 1');

/**
 * Individual schedule item validation schema.
 */
export const scheduleItemSchema = z
  .object({
    day_of_week: z.coerce
      .number()
      .int()
      .min(1, 'Day must be between 1 (Mon) and 7 (Sun)')
      .max(7, 'Day must be between 1 (Mon) and 7 (Sun)'),
    start_time: z
      .string()
      .trim()
      .regex(timeFormatRegex, 'Start time must be in HH:MM or HH:MM:SS format'),
    end_time: z
      .string()
      .trim()
      .regex(timeFormatRegex, 'End time must be in HH:MM or HH:MM:SS format'),
    capacity: scheduleCapacityField,
    tutor_id: z.string().trim().optional(),
    location: z.string().trim().optional(),
    valid_from: z.string().trim().optional(),
    enrollment_id: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      // Basic check that start_time comes before end_time
      if (data.start_time && data.end_time) {
        return data.start_time < data.end_time;
      }
      return true;
    },
    {
      message: 'End time must be strictly after start time',
      path: ['end_time'],
    }
  );

/**
 * Initial schedules request payload validation schema.
 * API Reference: POST /api/v1/schedules
 */
export const createScheduleSchema = z.object({
  class_id: z.string().trim().min(1, 'Please select a valid class'),
  schedules: z
    .array(scheduleItemSchema)
    .min(1, 'At least one recurring schedule slot is required'),
});

// Inferred Form / Input Types
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type ScheduleItemInput = z.infer<typeof scheduleItemSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateClassPublicationInput = z.infer<
  typeof updateClassPublicationSchema
>;

/** Enrollment status of a class, as accepted by the academic service. */
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

// Domain Entity Interfaces matching Swagger contract
export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at?: string;
}

export interface ClassEntity {
  id: string;
  tenant_id: string;
  category_id: string;
  name: string;
  type: 'private' | 'group';
  price: number;
  capacity?: number;
  description?: string;
  created_at: string;
  updated_at?: string;
  category?: Category;
  /**
   * Whether the class is listed publicly in `/kelas`. Always serialised by the
   * academic service, so it is optional only for older cached payloads.
   */
  is_published?: boolean;
  /**
   * Enrollment state of the class. A class appears in `/kelas` only when it is
   * published *and* has the `open` enrollment status.
   */
  enrollment_status?: EnrollmentStatus;
}

export interface ClassSchedule {
  id: string;
  class_id: string;
  day_of_week: number; // 1 = Monday, ..., 7 = Sunday
  start_time: string;
  end_time: string;
  /**
   * Seats this schedule slot offers. Always serialised by the academic service
   * (`capacity` is a non-pointer integer on the schedule row), so it is
   * optional only for payloads captured before the field existed.
   */
  capacity?: number;
  tutor_id?: string;
  location?: string;
  valid_from?: string;
  valid_until?: string;
  enrollment_id?: string;
  class?: ClassEntity;
}

export interface ClassSession {
  id: string;
  class_id: string;
  schedule_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'rescheduled' | 'cancelled' | 'completed';
  tutor_id?: string;
}

export interface CreateInitialSchedulesResponse {
  schedules: ClassSchedule[];
  sessions: ClassSession[];
}
