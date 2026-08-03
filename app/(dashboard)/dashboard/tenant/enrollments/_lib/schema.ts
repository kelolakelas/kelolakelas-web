import { z } from 'zod';

export const enrollmentSchema = z.object({
  class_id: z.string().trim().min(1, 'Class ID wajib diisi.'),
  student_id: z.string().trim().min(1, 'Student ID wajib diisi.'),
  billing_cycle: z.enum(['monthly', 'quarterly', 'yearly']),
  platform_fee: z.coerce.number().int().min(0, 'Platform fee tidak boleh negatif.'),
});

export const enrollmentStatusSchema = z.enum(['pending', 'active', 'completed', 'dropped']);
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;

export interface Enrollment {
  id: string;
  class_id: string;
  student_id: string;
  billing_cycle: EnrollmentInput['billing_cycle'];
  platform_fee?: number | null;
  status: EnrollmentStatus;
  joined_at?: string | null;
}
