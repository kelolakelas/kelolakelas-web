import { z } from 'zod';

export const studentSchema = z.object({
  full_name: z.string().trim().min(1, 'Nama lengkap wajib diisi.'),
  date_of_birth: z.string().date('Tanggal lahir harus valid.'),
});

export type StudentInput = z.infer<typeof studentSchema>;