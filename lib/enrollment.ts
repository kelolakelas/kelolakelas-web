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
};

export function enrollmentPayload(input: z.infer<typeof enrollmentFormSchema>) {
  return {
    student_id: input.student_id,
    billing_cycle: input.billing_cycle,
    ...(input.schedule_id ? { schedule_id: input.schedule_id } : {}),
  };
}
