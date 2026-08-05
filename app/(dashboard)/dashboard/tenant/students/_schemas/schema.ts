import { z } from 'zod';

export const studentSchema = z.object({
  first_name: z.string().trim().min(1, 'Nama depan wajib diisi.'),
  last_name: z.string().trim().optional(),
  date_of_birth: z.string().date('Tanggal lahir harus valid.'),
});

export type StudentInput = z.infer<typeof studentSchema>;