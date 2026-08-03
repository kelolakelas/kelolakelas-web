import { z } from 'zod';

export const attendanceSchema = z.object({ enrollment_id: z.string().uuid('Enrollment wajib dipilih.'), schedule_id: z.string().uuid('Schedule wajib dipilih.'), date: z.string().date('Tanggal harus valid.'), status: z.enum(['present', 'absent', 'late', 'excused']) });
export const attendanceUpdateSchema = z.object({ status: z.enum(['present', 'absent', 'late', 'excused']) });