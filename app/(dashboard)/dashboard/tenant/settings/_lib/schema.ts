import { z } from 'zod';

export const tenantSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Nama organisasi wajib diisi.').max(150),
  address: z.string().trim().max(500, 'Alamat terlalu panjang.').optional(),
  phone: z.string().trim().max(40, 'Nomor telepon terlalu panjang.').optional(),
});

export type TenantSettings = z.infer<typeof tenantSettingsSchema> & { id?: string };

export interface SettingsActionResponse {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}