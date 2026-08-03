import { z } from 'zod';

export const reportSchema = z.object({ enrollment_id: z.string().uuid('Enrollment wajib dipilih.'), title: z.string().trim().min(1, 'Judul wajib diisi.'), evaluation_notes: z.string().trim().optional(), score: z.coerce.number().min(0).max(100).optional() });
export const reportUpdateSchema = reportSchema.omit({ enrollment_id: true });