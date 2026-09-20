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
 * Class validation schema for creating a new class under a category.
 * API Reference: POST /api/v1/classes
 */
export const createClassSchema = z.object({
  category_id: z.string().trim().min(1, 'Please select a valid category'),
  name: z
    .string()
    .trim()
    .min(1, 'Class name is required')
    .max(100, 'Class name cannot exceed 100 characters'),
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
  description: z.string().trim().optional(),
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
