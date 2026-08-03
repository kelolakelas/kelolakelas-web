'use server';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { revalidatePath } from 'next/cache';
import { tenantSettingsSchema, type SettingsActionResponse } from '../_lib/schema';

export async function updateTenantSettings(
  _previous: SettingsActionResponse,
  formData: FormData
): Promise<SettingsActionResponse> {
  const validation = tenantSettingsSchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address') || undefined,
    phone: formData.get('phone') || undefined,
  });
  if (!validation.success) {
    return {
      success: false,
      message: 'Periksa kembali data pengaturan.',
      errors: validation.error.flatten().fieldErrors,
    };
  }

  try {
    await apiRequest('/api/v1/tenant/settings', {
      method: 'PATCH',
      body: JSON.stringify(validation.data),
    });
    revalidatePath('/dashboard/tenant/settings');
    revalidatePath('/dashboard/tenant');
    return { success: true, message: 'Pengaturan organisasi berhasil diperbarui.' };
  } catch (error) {
    if (error instanceof ApiError) return { success: false, message: error.message };
    console.error('[updateTenantSettings Error]:', error);
    return { success: false, message: 'Pengaturan gagal diperbarui. Silakan coba lagi.' };
  }
}