import { z } from 'zod';

const studentNoteSchema = z.object({
  content: z.string().trim().max(5000, 'Catatan maksimal 5000 karakter.'),
  note_type: z.enum(['medical', 'academic', 'behavioral']),
});

export const studentSchema = z.object({
  first_name: z.string().trim().min(1, 'Nama depan wajib diisi.').max(255, 'Nama depan maksimal 255 karakter.'),
  last_name: z.string().trim().max(255, 'Nama belakang maksimal 255 karakter.'),
  nickname: z.string().trim().max(100, 'Nama panggilan maksimal 100 karakter.'),
  gender: z.enum(['male', 'female']).optional(),
  date_of_birth: z.string().date('Tanggal lahir harus valid.').refine((value) => value <= new Date().toISOString().slice(0, 10), 'Tanggal lahir tidak boleh di masa depan.'),
  student_note: studentNoteSchema.optional(),
});

export type StudentInput = z.infer<typeof studentSchema>;