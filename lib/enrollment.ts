import { z } from 'zod';

export const enrollmentFormSchema = z.object({
  student_id: z.string().uuid('Pilih student yang valid.'),
  billing_cycle: z.enum(['monthly', 'quarterly', 'yearly'], { message: 'Pilih periode pembayaran.' }),
  schedule_id: z.union([z.string().uuid('Pilih jadwal yang valid.'), z.literal('')]),
  idempotency_key: z.string().uuid('Sesi checkout tidak valid. Muat ulang halaman lalu coba lagi.'),
});

export type EnrollmentActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
  /** Follow-up page shown as a link under the message, e.g. the parent's enrollment status. */
  link?: { href: string; label: string };
};

export const PARENT_ENROLLMENTS_PATH = '/dashboard/parent/enrollments';

/** Machine-readable `code` academic sends with the 409 for a student already enrolled in the class. */
export const DUPLICATE_ENROLLMENT_CODE = 'duplicate_enrollment';

export const duplicateEnrollmentState: EnrollmentActionState = {
  success: false,
  message: 'Student ini sudah terdaftar atau masih memiliki pembayaran tertunda di kelas ini.',
  link: { href: PARENT_ENROLLMENTS_PATH, label: 'Lihat status enrollment' },
};

/**
 * True only for academic's duplicate-enrollment 409. A full schedule or an
 * idempotency conflict is also 409 but carries no `code`, and an older backend
 * never sends one, so both keep the generic 409 message.
 */
export function isDuplicateEnrollmentResponse(status: number, result: unknown) {
  return status === 409 && typeof result === 'object' && result !== null && (result as { code?: unknown }).code === DUPLICATE_ENROLLMENT_CODE;
}

export function enrollmentPayload(input: z.infer<typeof enrollmentFormSchema>) {
  return {
    student_id: input.student_id,
    billing_cycle: input.billing_cycle,
    ...(input.schedule_id ? { schedule_id: input.schedule_id } : {}),
  };
}
