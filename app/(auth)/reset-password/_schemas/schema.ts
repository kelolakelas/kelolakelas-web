import { z } from 'zod';

export const requestResetSchema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi.').email('Masukkan alamat email yang valid.'),
});

export const confirmResetSchema = z.object({
  token: z.string().trim().min(1, 'Tautan reset tidak valid atau sudah kedaluwarsa.'),
  password: z.string().min(6, 'Password minimal 6 karakter.'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Konfirmasi password tidak cocok.',
  path: ['confirmPassword'],
});
